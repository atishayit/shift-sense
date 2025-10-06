import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis/redis.service';

type EmpLite = { id: string; code: string; firstName: string; lastName: string };

@Injectable()
export class EmpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  private keyEmployees(orgId: string) {
    return `org:${orgId}:employees:list`;
  }

  async list(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true },
    });
    if (!org) return [];

    const cacheKey = this.keyEmployees(org.id);

    // 1) try cache
    const hit = await this.redis.getJSON<EmpLite[]>(cacheKey);
    if (hit) return hit;

    // 2) query DB
    const rows = await this.prisma.employee.findMany({
      where: { orgId: org.id },
      select: { id: true, code: true, firstName: true, lastName: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    // 3) cache it for 60s
    await this.redis.setJSON(cacheKey, rows, 60);
    return rows;
  }

  addAvailability(
    employeeId: string,
    body: { weekday: number; startTime: string; endTime: string },
  ) {
    return this.prisma.availability.create({
      data: {
        employeeId,
        weekday: body.weekday,
        startTime: body.startTime,
        endTime: body.endTime,
      },
    });
  }

  addTimeOff(
    employeeId: string,
    body: { start: string; end: string; reason?: string },
  ) {
    return this.prisma.timeOff.create({
      data: {
        employeeId,
        start: new Date(body.start),
        end: new Date(body.end),
        reason: body.reason ?? null,
      },
    });
  }
}
