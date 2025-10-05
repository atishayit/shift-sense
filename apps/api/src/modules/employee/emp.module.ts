import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { EmpService } from './emp.service';
import { EmpController } from './emp.controller';

@Module({
    imports: [PrismaModule],
    providers: [EmpService],
    controllers: [EmpController],
    exports: [EmpService],
})
export class EmpModule { }
