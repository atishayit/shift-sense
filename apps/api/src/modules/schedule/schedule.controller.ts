import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyProtected } from 'src/auth/api-key.decorator';
import { SolverService } from '../solver/solver.service';

@ApiTags('schedules')
@Controller()
export class ScheduleController {
  constructor(private readonly svc: ScheduleService, private readonly solver: SolverService) { }

  @Post('orgs/:orgRef/schedules/generate')
  @ApiKeyProtected()
  generate(@Param('orgRef') orgRef: string, @Body() body: { weekStartISO: string }) {
    return this.svc.generate(orgRef, body.weekStartISO);
  }

  @Post('orgs/:orgRef/schedules/:id/solve')
  @ApiKeyProtected()
  solve(@Param('orgRef') orgRef: string, @Param('id') id: string) {
    // delegates to existing solver via service you already use elsewhere
    return this.solver.run(orgRef, id);
  }

  @Get('orgs/:orgRef/schedules') list(@Param('orgRef') orgRef: string) { return this.svc.list(orgRef); }
  @Get('schedules/:id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Get('schedules/:id/summary') summary(@Param('id') id: string) { return this.svc.summary(id); }

  @Get('orgs/:orgRef/preset') getPreset(@Param('orgRef') orgRef: string) { return this.svc.getPreset(orgRef); }

  @Put('orgs/:orgRef/preset')
  @ApiKeyProtected()
  savePreset(@Param('orgRef') orgRef: string, @Body() body: any) { return this.svc.savePreset(orgRef, body); }

  @Patch('assignments/:id/pin')
  @ApiKeyProtected()
  pin(@Param('id') id: string) { return this.svc.pinAssignment(id, true); }

  @Patch('assignments/:id/unpin')
  @ApiKeyProtected()
  unpin(@Param('id') id: string) { return this.svc.pinAssignment(id, false); }

  @Patch('assignments/pin')
  @ApiKeyProtected()
  pinByPair(@Body() body: { shiftId: string; employeeId: string }) {
    return this.svc.pinByPair(body.shiftId, body.employeeId, true);
  }

  @Patch('assignments/unpin')
  @ApiKeyProtected()
  unpinByPair(@Body() body: { shiftId: string; employeeId: string }) {
    return this.svc.pinByPair(body.shiftId, body.employeeId, false);
  }
}
