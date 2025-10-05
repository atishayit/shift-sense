import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  write(data: { orgId?: string; userId?: string | null; entity: string; entityId: string; action: string; meta?: any }) {
    return this.prisma.auditLog.create({ data: { ...data, meta: data.meta ?? {} } });
  }
}
