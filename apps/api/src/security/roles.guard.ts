import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  // expects x-user-id header containing User.id; checks Membership.role at org level
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = (req.headers['x-user-id'] as string) || null;
    if (!userId) return false;
    const orgRef: string | undefined = req.params['orgRef'] || req.params['orgId'] || undefined;
    if (!orgRef) return false;

    const org = await this.prisma.organization.findFirst({ where: { OR: [{id: orgRef},{slug: orgRef}] }, select: { id: true } });
    if (!org) return false;

    const m = await this.prisma.membership.findFirst({ where: { orgId: org.id, userId }, select: { role: true } });
    if (!m) return false;
    // allow MANAGER and above
    return ['OWNER','ADMIN','MANAGER'].includes(m.role);
  }
}
