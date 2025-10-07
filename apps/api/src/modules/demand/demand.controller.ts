import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DemandService } from './demand.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyProtected } from 'src/auth/api-key.decorator';

@ApiTags('demand')
@Controller('orgs/:orgRef/demand')
export class DemandController {
  constructor(private readonly svc: DemandService) { }

  @Get()
  list(@Param('orgRef') orgRef: string, @Query('locationId') locationId?: string) {
    return this.svc.list(orgRef, locationId);
  }

  @Post()
  @ApiKeyProtected()
  create(@Param('orgRef') orgRef: string, @Body() dto: any) {
    return this.svc.create(orgRef, dto);
  }

  @Put(':id')
  @ApiKeyProtected()
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiKeyProtected()
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
