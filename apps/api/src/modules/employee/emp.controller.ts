import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EmpService } from './emp.service';

@Controller() // NOTE: empty because global prefix = 'api'
export class EmpController {
  constructor(private readonly svc: EmpService) {}

  @Get('orgs/:orgRef/employees')
  list(@Param('orgRef') orgRef: string) { return this.svc.list(orgRef); }

  @Post('employees/:id/availability')
  addAvailability(
    @Param('id') employeeId: string,
    @Body() body: { weekday: number; startTime: string; endTime: string },
  ) {
    return this.svc.addAvailability(employeeId, body);
  }

  @Post('employees/:id/timeoff')
  addTimeOff(
    @Param('id') employeeId: string,
    @Body() body: { start: string; end: string; reason?: string },
  ) {
    return this.svc.addTimeOff(employeeId, body);
  }
}
