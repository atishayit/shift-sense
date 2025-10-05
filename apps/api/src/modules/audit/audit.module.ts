import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AuditController } from './audit.controller';

@Module({
    controllers: [AuditController],
    providers: [PrismaService],
})
export class AuditModule { }
