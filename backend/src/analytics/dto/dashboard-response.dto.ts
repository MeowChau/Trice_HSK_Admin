import { ApiProperty } from '@nestjs/swagger';

export class DashboardResponseDto {
  @ApiProperty({ example: 1.5, description: 'Total study time today in hours' })
  timeToday: number;

  @ApiProperty({
    example: 10.5,
    description: 'Total study time in the last 7 days in hours',
  })
  time7Days: number;

  @ApiProperty({
    example: 50.0,
    description: 'Total study time all time in hours',
  })
  timeTotal: number;

  @ApiProperty({
    example: [1, 2, 0, 1.5, 3, 2, 4],
    type: [Number],
    description: 'Study time per day for the last 7 days',
  })
  chart7Days: number[];

  @ApiProperty({ example: 10, description: 'Total distinct days studied' })
  totalDaysStudied: number;

  @ApiProperty({
    example: 1.5,
    description: 'Average study time per day in hours',
  })
  averagePerDay: number;

  @ApiProperty({
    example: 5,
    description: 'Longest streak of consecutive days studied',
  })
  longestStreak: number;
}
