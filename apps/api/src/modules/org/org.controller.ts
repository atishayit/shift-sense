import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { OrgService } from './org.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiKeyProtected } from 'src/auth/api-key.decorator';

@ApiTags('orgs')
@Controller('orgs')
export class OrgController {
  constructor(private readonly svc: OrgService) { }

  @Get()
  list() { return this.svc.list(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post()
  @ApiKeyProtected()
  create(@Body() dto: { name: string; slug: string; timezone?: string }) { return this.svc.create(dto); }

  @Put(':id')
  @ApiKeyProtected()
  update(@Param('id') id: string, @Body() dto: Partial<{ name: string; slug: string; timezone: string }>) { return this.svc.update(id, dto); }

  @Delete(':id')
  @ApiKeyProtected()
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
