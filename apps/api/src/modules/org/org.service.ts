import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}
  list() { return this.prisma.organization.findMany({ orderBy: { createdAt: 'desc' } }); }
  get(id: string) { return this.prisma.organization.findUnique({ where: { id } }); }
  create(dto: { name: string; slug: string; timezone?: string }) {
    return this.prisma.organization.create({ data: dto });
  }
  update(id: string, dto: Partial<{ name: string; slug: string; timezone: string }>) {
    return this.prisma.organization.update({ where: { id }, data: dto });
  }
  remove(id: string) { return this.prisma.organization.delete({ where: { id } }); }
}
