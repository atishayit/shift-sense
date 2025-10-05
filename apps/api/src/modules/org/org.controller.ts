import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { OrgService } from './org.service';

@Controller('orgs') // <-- remove "api/"
export class OrgController {
  constructor(private readonly svc: OrgService) {}
  @Get() list() { return this.svc.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post() create(@Body() dto: { name: string; slug: string; timezone?: string }) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: Partial<{ name: string; slug: string; timezone: string }>) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
