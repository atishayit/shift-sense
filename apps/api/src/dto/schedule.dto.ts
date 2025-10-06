import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional } from 'class-validator';

export class GenerateScheduleDto {
    @ApiProperty({ example: '2025-09-29', description: 'ISO date for week start (local)' })
    @IsDateString()
    weekStartISO!: string;
}

export class SolveDto {
    @ApiPropertyOptional({ example: { cost: 1.0, spread: 0.1 } })
    @IsOptional() @IsObject()
    weights?: Record<string, number>;
}
