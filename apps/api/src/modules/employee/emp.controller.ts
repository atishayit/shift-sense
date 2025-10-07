import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EmpService } from './emp.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyProtected } from 'src/auth/api-key.decorator';

@ApiTags('employees')
@Controller()
export class EmpController {
  constructor(private svc: EmpService) { }

  @Get('orgs/:orgRef/employees')
  list(@Param('orgRef') orgRef: string) { return this.svc.list(orgRef); }

  @Post('employees/:id/availability')
  @ApiKeyProtected()
  addAvailability(
    @Param('id') employeeId: string,
    @Body() body: { weekday: number; startTime: string; endTime: string },
  ) {
    return this.svc.addAvailability(employeeId, body);
  }

  @Post('employees/:id/timeoff')
  @ApiKeyProtected()
  addTimeOff(
    @Param('id') employeeId: string,
    @Body() body: { start: string; end: string; reason?: string },
  ) {
    return this.svc.addTimeOff(employeeId, body);
  }
}
