import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AuditService } from '../../common/audit.service';

@Injectable()
export class SolverService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private audit: AuditService,
  ) { }

  private async orgIdFromRef(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true },
    });
    if (!org) throw new HttpException('Org not found', 404);
    return org.id;
  }

  private async getPinned(scheduleId: string) {
    const rows = await this.prisma.assignment.findMany({
      where: { shift: { scheduleId }, isPinned: true },
      select: { shiftId: true, employeeId: true },
    });
    return rows.map(r => ({ shiftId: r.shiftId, employeeId: r.employeeId }));
  }

  async run(orgRef: string, scheduleId: string, weights?: Record<string, number>) {
    const orgId = await this.orgIdFromRef(orgRef);

    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, orgId },
      include: { shifts: true },
    });
    if (!schedule) throw new HttpException('Schedule not found', 404);

    const employees = await this.prisma.employee.findMany({
      where: { orgId },
      select: {
        id: true, hourlyCost: true, roleId: true, maxWeeklyHours: true,
        employmentType: true,
        availabilities: { select: { weekday: true, startTime: true, endTime: true } },
        timeOffs: { select: { start: true, end: true } },
      },
    });

    const preset = await this.prisma.constraintPreset.findFirst({ where: { orgId } });
    const config = preset?.config ?? { weights: { cost: 1, casualPenalty: 50, consecutivePenalty: 20 } };
    const pinned = await this.getPinned(scheduleId);
    const pinnedSet = new Set(pinned.map(p => `${p.shiftId}:${p.employeeId}`));

    const payload: any = {
      config,
      shifts: schedule.shifts.map(s => ({ id: s.id, start: s.start.toISOString(), end: s.end.toISOString(), required: s.required, roleId: s.roleId })),
      employees: employees.map(e => ({
        id: e.id,
        hourlyCost: Number(e.hourlyCost),
        roleIds: e.roleId ? [e.roleId] : [],
        maxWeeklyHours: e.maxWeeklyHours ?? 38,
        employmentType: e.employmentType,
        avail: e.availabilities.map(a => ({ weekday: a.weekday, start: a.startTime, end: a.endTime })),
        timeOffs: e.timeOffs.map(t => ({ start: t.start.toISOString(), end: t.end.toISOString() })),
      })),
      pinned,
    };
    if (weights) payload.weights = weights;

    const run = await this.prisma.scheduleRun.create({
      data: { scheduleId, status: 'RUNNING', solver: 'cp-sat', startedAt: new Date() },
    });

    try {
      // call solver
      const resp = await firstValueFrom(
        this.http.post('http://127.0.0.1:5001/solve', payload, { timeout: 20000 }),
      );
      
      const data = resp.data as { assignments?: { shiftId: string; employeeId: string }[]; objective?: number };

      // wipe and recreate (preserve pins)
      await this.prisma.assignment.deleteMany({ where: { shift: { scheduleId } } });
      if (data.assignments?.length) {
        const shiftMap = new Map(schedule.shifts.map(s => [s.id, s]));
        const empMap = new Map(employees.map(e => [e.id, e]));
        await this.prisma.assignment.createMany({
          data: data.assignments.map(a => {
            const s = shiftMap.get(a.shiftId)!;
            const e = empMap.get(a.employeeId)!;
            const hours = (s.end.getTime() - s.start.getTime()) / 3_600_000;
            const cost = Number(e.hourlyCost) * hours;
            const key = `${a.shiftId}:${a.employeeId}`;
            return { shiftId: a.shiftId, employeeId: a.employeeId, cost, isPinned: pinnedSet.has(key) };
          }),
        });
      }

      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'OK',
          finishedAt: new Date(),
          objective: data.objective ?? null,
          violations: {},
          costBreakdown: {},
        },
      });

      // audit: success
      await this.audit.write({
        orgId: schedule.orgId,
        userId: null,
        entity: 'Schedule',
        entityId: scheduleId,
        action: 'SOLVE_OK',
        meta: { objective: data.objective ?? null, assignments: data.assignments?.length ?? 0 },
      });

      return this.prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          shifts: {
            include: {
              assignments: { include: { employee: { select: { code: true, firstName: true, lastName: true } } } },
              role: { select: { name: true } },
              location: { select: { name: true } },
            },
            orderBy: { start: 'asc' },
          },
          runs: true,
        },
      });
    } catch (err: any) {
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', finishedAt: new Date() },
      });

      // audit: failure
      await this.audit.write({
        orgId: schedule.orgId,
        userId: null,
        entity: 'Schedule',
        entityId: scheduleId,
        action: 'SOLVE_FAILED',
        meta: { error: err?.response?.data ?? err?.message ?? 'Unknown' },
      });

      throw new HttpException(
        { message: 'Solver failed', detail: err?.response?.data ?? err?.message ?? 'Unknown error' },
        502,
      );
    }
  }
}
