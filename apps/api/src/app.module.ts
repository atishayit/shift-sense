import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { OrgModule } from './modules/org/org.module';
import { EmpModule } from './modules/employee/emp.module';
import { DemandModule } from './modules/demand/demand.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SolverModule } from './modules/solver/solver.module';
import { AuditService } from './common/audit.service';
@Module({
    imports: [PrismaModule, OrgModule, EmpModule, DemandModule, ScheduleModule, SolverModule],
    providers: [AuditService]
})
export class AppModule { }
