import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class EmpService {
  constructor(private readonly prisma: PrismaService) { }

  async list(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
    });
    return this.prisma.employee.findMany({
      where: { orgId: org?.id },
      select: { id: true, code: true, firstName: true, lastName: true },
    });
  }

  // NEW
  addAvailability(employeeId: string, body: { weekday: number; startTime: string; endTime: string }) {
    return this.prisma.availability.create({
      data: { employeeId, weekday: body.weekday, startTime: body.startTime, endTime: body.endTime },
    });
  }

  // NEW
  addTimeOff(employeeId: string, body: { start: string; end: string; reason?: string }) {
    return this.prisma.timeOff.create({
      data: { employeeId, start: new Date(body.start), end: new Date(body.end), reason: body.reason ?? null },
    });
  }
}
