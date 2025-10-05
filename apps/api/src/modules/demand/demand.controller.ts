import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DemandService } from './demand.service';

@Controller('orgs/:orgRef/demand') // remove "api/"
export class DemandController {
  constructor(private readonly svc: DemandService) {}

  @Get()
  list(@Param('orgRef') orgRef: string, @Query('locationId') locationId?: string) {
    return this.svc.list(orgRef, locationId);
  }

  @Post()
  create(@Param('orgRef') orgRef: string, @Body() dto: any) {
    return this.svc.create(orgRef, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
