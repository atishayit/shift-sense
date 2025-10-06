import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, IsOptional } from 'class-validator';

export class CreateOrgDto {
  @ApiProperty() @IsString()
  name!: string;

  @ApiProperty({ example: 'demo' })
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiPropertyOptional({ example: 'Australia/Melbourne' })
  @IsOptional() @IsString()
  timezone?: string;
}
