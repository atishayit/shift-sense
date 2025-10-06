import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private redis: RedisService,
  ) { }

  private async orgIdFromRef(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true },
    });
    if (!org) throw new Error('Org not found');
    return org.id;
  }

  private keyList(orgId: string) { return `schedules:list:${orgId}`; }
  private keyOne(id: string) { return `schedule:${id}`; }
  private keySummary(id: string) { return `schedule:${id}:summary`; }

  async list(orgRef: string) {
    const orgId = await this.orgIdFromRef(orgRef);
    const k = this.keyList(orgId);

    const hit = await this.redis.getJSON<{ id: string; weekStart: Date; weekEnd: Date; status: string }[]>(k);
    if (hit) return hit;

    const rows = await this.prisma.schedule.findMany({
      where: { orgId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, weekStart: true, weekEnd: true, status: true },
    });

    await this.redis.setJSON(k, rows, 60);
    return rows;
  }

  async get(id: string) {
    const k = this.keyOne(id);
    const cached = await this.redis.getJSON<any>(k);
    if (cached) return cached;

    const s = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        shifts: {
          include: {
            location: { select: { name: true } },
            role: { select: { name: true } },
            assignments: {
              include: {
                // include employee.id so UI can call pair-based pin/unpin
                employee: { select: { id: true, code: true, firstName: true, lastName: true } },
              },
            },
          },
          orderBy: [{ start: 'asc' }],
        },
        runs: true,
      },
    });
    if (!s) return s;

    const totalCost = s.shifts.reduce(
      (acc, sh) => acc + sh.assignments.reduce((a, asg) => a + Number(asg.cost ?? 0), 0),
      0,
    );
    const out = { ...s, totalCost };

    await this.redis.setJSON(k, out, 60);
    return out;
  }

  async summary(id: string) {
    const k = this.keySummary(id);
    const hit = await this.redis.getJSON<any>(k);
    if (hit) return hit;

    const s = await this.prisma.schedule.findUnique({
      where: { id },
      include: { shifts: { include: { assignments: true } }, runs: true },
    });
    if (!s) return null;

    const totalCost = s.shifts.reduce(
      (acc, sh) => acc + sh.assignments.reduce((a, asg) => a + Number(asg.cost ?? 0), 0),
      0,
    );
    const required = s.shifts.reduce((a, sh) => a + sh.required, 0);
    const assigned = s.shifts.reduce((a, sh) => a + sh.assignments.length, 0);
    const coverage = required ? Math.round((assigned / required) * 100) : 100;
    const out = { id: s.id, weekStart: s.weekStart, totalCost, coverage, runs: s.runs };

    await this.redis.setJSON(k, out, 60);
    return out;
  }

  async getPreset(orgRef: string) {
    const orgId = await this.orgIdFromRef(orgRef);
    const p = await this.prisma.constraintPreset.findFirst({ where: { orgId } });
    return p ?? {
      id: null, orgId, name: 'Default',
      config: { weights: { cost: 1, casualPenalty: 50, consecutivePenalty: 20 } }
    };
  }

  async savePreset(orgRef: string, config: any) {
    const orgId = await this.orgIdFromRef(orgRef);
    const existing = await this.prisma.constraintPreset.findFirst({ where: { orgId } });
    const preset = existing
      ? await this.prisma.constraintPreset.update({ where: { id: existing.id }, data: { config } })
      : await this.prisma.constraintPreset.create({ data: { orgId: orgId, name: 'Default', config } });

    await this.audit.write({
      orgId: orgId,
      userId: null,
      entity: 'ConstraintPreset',
      entityId: preset.id,
      action: 'PRESET_SAVE',
      meta: { name: preset.name },
    });

    // conservative: bust schedules list (consumers may re-read with new weights)
    await this.redis.del(this.keyList(orgId));
    return preset;
  }

  // --- Pin/Unpin by assignment id (kept for compatibility, friendlier error + cache busting) ---
  async pinAssignment(id: string, isPinned: boolean) {
    const exists = await this.prisma.assignment.findUnique({ where: { id } });
    if (!exists) {
      throw new HttpException('Assignment not found. Refresh the roster and try again.', 404);
    }
    const updated = await this.prisma.assignment.update({ where: { id }, data: { isPinned } });

    const emp = await this.prisma.employee.findUnique({
      where: { id: updated.employeeId },
      select: { orgId: true },
    });

    await this.audit.write({
      orgId: emp?.orgId ?? undefined,
      userId: null,
      entity: 'Assignment',
      entityId: updated.id,
      action: isPinned ? 'PIN' : 'UNPIN',
      meta: { shiftId: updated.shiftId, employeeId: updated.employeeId },
    });

    // bust caches touching this schedule
    const sh = await this.prisma.shift.findUnique({
      where: { id: updated.shiftId },
      select: { scheduleId: true },
    });
    if (sh?.scheduleId) {
      await this.redis.del(this.keyOne(sh.scheduleId));
      await this.redis.del(this.keySummary(sh.scheduleId));
    }

    return updated;
  }

  // --- New: Pin/Unpin by stable pair (shiftId, employeeId) with cache busting ---
  async pinByPair(shiftId: string, employeeId: string, isPinned: boolean) {
    const updated = await this.prisma.assignment.update({
      // requires a unique on (shiftId, employeeId) in your Prisma schema
      where: { shiftId_employeeId: { shiftId, employeeId } },
      data: { isPinned },
    });

    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { orgId: true },
    });

    await this.audit.write({
      orgId: emp?.orgId ?? undefined,
      userId: null,
      entity: 'Assignment',
      entityId: updated.id,
      action: isPinned ? 'PIN' : 'UNPIN',
      meta: { shiftId: updated.shiftId, employeeId: updated.employeeId },
    });

    // bust caches touching this schedule
    const sh = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      select: { scheduleId: true },
    });
    if (sh?.scheduleId) {
      await this.redis.del(this.keyOne(sh.scheduleId));
      await this.redis.del(this.keySummary(sh.scheduleId));
    }

    return updated;
  }
}
