import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class HistoryPoint {
  @ApiProperty({ example: '2025-09-01' }) @IsDateString()
  date!: string;

  @ApiProperty({ example: 42 }) @IsNumber()
  y!: number;
}

export class ForecastRequestDto {
  @ApiProperty({ type: [HistoryPoint] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => HistoryPoint)
  history!: HistoryPoint[];

  @ApiPropertyOptional({ example: 14 })
  @IsOptional() @IsInt() @Min(1)
  horizonDays?: number;

  @ApiPropertyOptional({ example: 'D', description: 'Pandas-like frequency: D,W,M' })
  @IsOptional() @IsString()
  freq?: string;

  @ApiPropertyOptional({ example: 0.2, description: 'test size for rolling backtests' })
  @IsOptional() @IsNumber()
  testSize?: number;
}
