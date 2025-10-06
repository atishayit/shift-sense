import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class DemandService {
  constructor(
    private prisma: PrismaService,
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

  private keyDemand(orgId: string, locationId?: string) {
    return locationId
      ? `demand:${orgId}:loc:${locationId}`
      : `demand:${orgId}:all`;
  }

  async list(orgRef: string, locationId?: string) {
    const orgId = await this.orgIdFromRef(orgRef);
    const k = this.keyDemand(orgId, locationId);

    const hit = await this.redis.getJSON<any[]>(k);
    if (hit) return hit;

    const rows = await this.prisma.shiftDemandTemplate.findMany({
      where: { location: { orgId }, ...(locationId ? { locationId } : {}) },
      orderBy: [{ locationId: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }],
    });

    await this.redis.setJSON(k, rows, 60);
    return rows;
  }

  async create(
    orgRef: string,
    dto: { locationId: string; roleId: string; weekday: number; startTime: string; endTime: string; required: number },
  ) {
    const orgId = await this.orgIdFromRef(orgRef);
    const row = await this.prisma.shiftDemandTemplate.create({ data: dto });

    // bust both location-specific and org-wide caches
    await this.redis.del(this.keyDemand(orgId));
    await this.redis.del(this.keyDemand(orgId, dto.locationId));
    return row;
  }

  async update(
    id: string,
    dto: Partial<{ locationId: string; roleId: string; weekday: number; startTime: string; endTime: string; required: number }>,
  ) {
    const before = await this.prisma.shiftDemandTemplate.findUnique({ where: { id } });
    const row = await this.prisma.shiftDemandTemplate.update({ where: { id }, data: dto });

    if (before) {
      const loc = dto.locationId ?? before.locationId;
      const org = await this.prisma.location.findUnique({ where: { id: loc }, select: { orgId: true } });
      if (org?.orgId) {
        await this.redis.del(this.keyDemand(org.orgId));
        await this.redis.del(this.keyDemand(org.orgId, loc));
      }
    }
    return row;
  }

  async remove(id: string) {
    const before = await this.prisma.shiftDemandTemplate.findUnique({ where: { id } });
    const row = await this.prisma.shiftDemandTemplate.delete({ where: { id } });

    if (before) {
      const org = await this.prisma.location.findUnique({ where: { id: before.locationId }, select: { orgId: true } });
      if (org?.orgId) {
        await this.redis.del(this.keyDemand(org.orgId));
        await this.redis.del(this.keyDemand(org.orgId, before.locationId));
      }
    }
    return row;
  }
}
