import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../../common/common.module';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';

@Module({
  imports: [CommonModule, HttpModule],
  providers: [ForecastService],
  controllers: [ForecastController],
})
export class ForecastModule {}
