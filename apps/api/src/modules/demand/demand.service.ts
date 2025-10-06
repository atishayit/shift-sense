import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class DemandService {
  constructor(private prisma: PrismaService, private redis: RedisService) { }

  private async orgIdFromRef(orgRef: string) {
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgRef }, { slug: orgRef }] },
      select: { id: true },
    });
    if (!org) throw new Error('Org not found');
    return org.id;
  }

  private keyList(orgId: string, locationId?: string) {
    return `demand:${orgId}:${locationId ?? 'all'}`;
  }

  async list(orgRef: string, locationId?: string) {
    const orgId = await this.orgIdFromRef(orgRef);
    const k = this.keyList(orgId, locationId);

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
    const created = await this.prisma.shiftDemandTemplate.create({ data: dto });

    // bust caches (all + specific location)
    await this.redis.del(this.keyList(orgId));
    await this.redis.del(this.keyList(orgId, dto.locationId));
    return created;
  }

  async update(
    id: string,
    dto: Partial<{ locationId: string; roleId: string; weekday: number; startTime: string; endTime: string; required: number }>,
  ) {
    // fetch to know current org/location for cache keys
    const before = await this.prisma.shiftDemandTemplate.findUnique({
      where: { id }, select: { locationId: true, location: { select: { orgId: true } } },
    });

    const updated = await this.prisma.shiftDemandTemplate.update({ where: { id }, data: dto });

    if (before?.location?.orgId) {
      const orgId = before.location.orgId;
      await this.redis.del(this.keyList(orgId)); // all
      await this.redis.del(this.keyList(orgId, before.locationId)); // old location bucket
      if (dto.locationId && dto.locationId !== before.locationId) {
        await this.redis.del(this.keyList(orgId, dto.locationId)); // new location bucket
      }
    }
    return updated;
  }

  async remove(id: string) {
    // fetch to know org/location for cache keys
    const before = await this.prisma.shiftDemandTemplate.findUnique({
      where: { id }, select: { locationId: true, location: { select: { orgId: true } } },
    });

    const removed = await this.prisma.shiftDemandTemplate.delete({ where: { id } });

    if (before?.location?.orgId) {
      const orgId = before.location.orgId;
      await this.redis.del(this.keyList(orgId));
      await this.redis.del(this.keyList(orgId, before.locationId));
    }
    return removed;
  }
}
