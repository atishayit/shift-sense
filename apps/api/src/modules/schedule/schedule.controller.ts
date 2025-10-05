import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ScheduleService } from './schedule.service';

@Controller() // empty because main.ts sets global 'api'
export class ScheduleController {
  constructor(private readonly svc: ScheduleService) { }

  @Get('orgs/:orgRef/schedules') list(@Param('orgRef') orgRef: string) { return this.svc.list(orgRef); }
  @Get('schedules/:id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Get('schedules/:id/summary') summary(@Param('id') id: string) { return this.svc.summary(id); }

  @Get('orgs/:orgRef/preset') getPreset(@Param('orgRef') orgRef: string) { return this.svc.getPreset(orgRef); }
  @Put('orgs/:orgRef/preset') savePreset(@Param('orgRef') orgRef: string, @Body() body: any) { return this.svc.savePreset(orgRef, body); }

  // NEW
  @Patch('assignments/:id/pin') pin(@Param('id') id: string) { return this.svc.pinAssignment(id, true); }
  @Patch('assignments/:id/unpin') unpin(@Param('id') id: string) { return this.svc.pinAssignment(id, false); }
}
