import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService, private redis: RedisService) { }

  private keyList() { return 'org:list'; }
  private keyOne(id: string) { return `org:${id}`; }

  async list() {
    const k = this.keyList();
    const hit = await this.redis.getJSON<any[]>(k);
    if (hit) return hit;

    const rows = await this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' } });
    await this.redis.setJSON(k, rows, 60);
    return rows;
  }

  async get(id: string) {
    const k = this.keyOne(id);
    const hit = await this.redis.getJSON<any>(k);
    if (hit) return hit;

    const row = await this.prisma.organization.findUnique({ where: { id } });
    if (row) await this.redis.setJSON(k, row, 60);
    return row;
  }

  async create(dto: { name: string; slug: string; timezone?: string }) {
    const created = await this.prisma.organization.create({ data: dto });
    // bust caches
    await this.redis.del(this.keyList());
    await this.redis.del(this.keyOne(created.id));
    return created;
  }

  async update(id: string, dto: Partial<{ name: string; slug: string; timezone: string }>) {
    const updated = await this.prisma.organization.update({ where: { id }, data: dto });
    // bust caches
    await this.redis.del(this.keyList());
    await this.redis.del(this.keyOne(id));
    return updated;
  }

  async remove(id: string) {
    const removed = await this.prisma.organization.delete({ where: { id } });
    // bust caches
    await this.redis.del(this.keyList());
    await this.redis.del(this.keyOne(id));
    return removed;
  }
}
