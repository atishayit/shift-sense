import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { OrgModule } from './modules/org/org.module';
import { EmpModule } from './modules/employee/emp.module';
import { DemandModule } from './modules/demand/demand.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SolverModule } from './modules/solver/solver.module';
import { AuditService } from './common/audit.service';
import { AuditModule } from './modules/audit/audit.module';
import { ForecastModule } from './modules/forecast/forecast.module';
@Module({
    imports: [PrismaModule, OrgModule, EmpModule, DemandModule, ScheduleModule, SolverModule, AuditModule, ForecastModule],
    providers: [AuditService]
})
export class AppModule { }
