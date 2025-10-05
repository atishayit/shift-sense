import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller()
export class ScheduleController {
  constructor(private readonly svc: ScheduleService) { }

  @Get('orgs/:orgRef/schedules') list(@Param('orgRef') orgRef: string) { return this.svc.list(orgRef); }
  @Get('schedules/:id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Get('schedules/:id/summary') summary(@Param('id') id: string) { return this.svc.summary(id); }

  // PRESET ROUTES
  @Get('orgs/:orgRef/preset') getPreset(@Param('orgRef') orgRef: string) { return this.svc.getPreset(orgRef); }
  @Put('orgs/:orgRef/preset') savePreset(@Param('orgRef') orgRef: string, @Body() body: any) {
    return this.svc.savePreset(orgRef, body);
  }
}
