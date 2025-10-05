import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class ScheduleService {
  constructor(private prisma: PrismaService, private audit: AuditService) { }

  private async orgIdFromRef(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true },
    });
    if (!org) throw new Error('Org not found');
    return org.id;
  }

  async list(orgRef: string) {
    const orgId = await this.orgIdFromRef(orgRef);
    return this.prisma.schedule.findMany({
      where: { orgId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, weekStart: true, weekEnd: true, status: true },
    });
  }

  async get(id: string) {
    const s = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        shifts: {
          include: {
            location: { select: { name: true } },
            role: { select: { name: true } },
            assignments: {
              include: {
                employee: { select: { code: true, firstName: true, lastName: true } },
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
    return { ...s, totalCost };
  }

  async summary(id: string) {
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
    return { id: s.id, weekStart: s.weekStart, totalCost, coverage, runs: s.runs };
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

    return preset;
  }

  async pinAssignment(id: string, isPinned: boolean) {
    const updated = await this.prisma.assignment.update({ where: { id }, data: { isPinned } });
    const emp = await this.prisma.employee.findUnique({ where: { id: updated.employeeId }, select: { orgId: true } });
    await this.audit.write({
      orgId: emp?.orgId,
      userId: null,
      entity: 'Assignment',
      entityId: updated.id,
      action: isPinned ? 'PIN' : 'UNPIN',
      meta: { shiftId: updated.shiftId, employeeId: updated.employeeId },
    });
    return updated;
  }
}
