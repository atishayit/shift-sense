import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Min, IsString } from 'class-validator';

export class DemandTemplateDto {
  @ApiProperty({ example: 1, description: '0=Sun … 6=Sat' })
  @IsInt() @Min(0)
  weekday!: number;

  @ApiProperty({ example: '09:00' })
  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @ApiProperty({ description: 'Role id to cover' })
  @IsString()
  roleId!: string;

  @ApiProperty({ example: 2 })
  @IsInt() @Min(1)
  required!: number;
}
