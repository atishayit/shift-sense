import { Controller, Get, Param, Query } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('forecast')
@Controller('orgs/:orgRef/forecast')
export class ForecastController {
  constructor(private svc: ForecastService) { }

  @Get()
  async get(
    @Param('orgRef') orgRef: string,
    @Query('horizon') horizon?: string,
  ) {
    const h = Math.max(7, Math.min(Number(horizon || '14'), 56));
    return this.svc.run(orgRef, h);
  }
}
