import { Body, Controller, Param, Post } from '@nestjs/common';
import { SolverService } from './solver.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyProtected } from 'src/auth/api-key.decorator';

@ApiTags('solver')
@Controller()
export class SolverController {
  constructor(private readonly svc: SolverService) {}

  @Post('orgs/:orgRef/schedules/:scheduleId/solve')
  @ApiKeyProtected()
  run(
    @Param('orgRef') orgRef: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: { weights?: Record<string, number> },
  ) {
    return this.svc.run(orgRef, scheduleId, dto?.weights);
  }
}
