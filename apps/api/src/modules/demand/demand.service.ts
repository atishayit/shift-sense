import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DemandService {
  constructor(private prisma: PrismaService) {}

  private async orgIdFromRef(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] }, select: { id: true }
    });
    if (!org) throw new Error('Org not found');
    return org.id;
  }

  list(orgRef: string, locationId?: string) {
    return this.orgIdFromRef(orgRef).then(orgId =>
      this.prisma.shiftDemandTemplate.findMany({
        where: { location: { orgId }, ...(locationId ? { locationId } : {}) },
        orderBy: [{ locationId: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }]
      })
    );
  }

  async create(orgRef: string, dto: { locationId: string; roleId: string; weekday: number; startTime: string; endTime: string; required: number }) {
    await this.orgIdFromRef(orgRef);
    return this.prisma.shiftDemandTemplate.create({ data: dto });
  }

  update(id: string, dto: Partial<{ locationId: string; roleId: string; weekday: number; startTime: string; endTime: string; required: number }>) {
    return this.prisma.shiftDemandTemplate.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.shiftDemandTemplate.delete({ where: { id } });
  }
}
