import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [PrismaModule],
  providers: [ScheduleService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
