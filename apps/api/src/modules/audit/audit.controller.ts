import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Controller('orgs/:orgRef/audit') // global 'api' is set in main.ts
export class AuditController {
    constructor(private prisma: PrismaService) { }

    @Get()
    async list(
        @Param('orgRef') orgRef: string,
        @Query('cursor') cursor?: string,
        @Query('take') take = '50',
    ) {
        const org = await this.prisma.organization.findFirst({
            where: { OR: [{ id: orgRef }, { slug: orgRef }] },
            select: { id: true },
        });
        if (!org) throw new NotFoundException('Org not found');

        return this.prisma.auditLog.findMany({
            where: { orgId: org.id },
            orderBy: { createdAt: 'desc' },
            take: Number(take),
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
    }
}
