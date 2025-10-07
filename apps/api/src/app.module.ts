import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { OrgModule } from './modules/org/org.module';
import { EmpModule } from './modules/employee/emp.module';
import { DemandModule } from './modules/demand/demand.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SolverModule } from './modules/solver/solver.module';
import { AuditModule } from './modules/audit/audit.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { RedisModule } from './redis/redis.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { APP_GUARD, Reflector } from '@nestjs/core';

@Module({
    imports: [
        PrismaModule,
        RedisModule,
        OrgModule,
        EmpModule,
        DemandModule,
        ScheduleModule,
        SolverModule,
        AuditModule,
        ForecastModule,
    ],
    providers: [
        Reflector,
        { provide: APP_GUARD, useClass: ApiKeyGuard },
    ],

})
export class AppModule { }
