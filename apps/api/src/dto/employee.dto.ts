import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsString, Matches, Min } from 'class-validator';

export class TimeOffDto {
    @ApiProperty() @IsDateString()
    start!: string;

    @ApiProperty() @IsDateString()
    end!: string;

    @ApiProperty() @IsString()
    reason!: string;
}

export class AvailabilityDto {
    @ApiProperty({ example: 1, description: '0=Sun … 6=Sat' })
    @IsInt() @Min(0)
    weekday!: number;

    @ApiProperty({ example: '09:00' })
    @Matches(/^\d{2}:\d{2}$/)
    startTime!: string;

    @ApiProperty({ example: '17:00' })
    @Matches(/^\d{2}:\d{2}$/)
    endTime!: string;
}
