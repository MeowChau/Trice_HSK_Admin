import { ApiProperty } from '@nestjs/swagger';

class ActivityTimesDto {
  @ApiProperty({ description: 'Vocabulary review time in seconds' })
  review: number;

  @ApiProperty({ description: 'Four-skill practice time in seconds' })
  practice: number;

  @ApiProperty({ description: 'HSK mock exam time in seconds' })
  exam: number;

  @ApiProperty({ description: 'PK time in seconds' })
  pk: number;
}

class VocabularyStatsDto {
  @ApiProperty({
    description: 'Distinct words with recorded learning activity',
  })
  learnedCount: number;

  @ApiProperty({ description: 'Words last self-rated remembered' })
  masteredCount: number;

  @ApiProperty({ description: 'Learned words not currently rated remembered' })
  learningCount: number;

  @ApiProperty({
    description: 'Words last self-rated unknown; a subset of learningCount',
  })
  reviewCount: number;
}

export class DashboardResponseDto {
  @ApiProperty({ example: 'Asia/Ho_Chi_Minh' })
  timeZone: string;

  @ApiProperty({ description: 'Exact study time today, in seconds' })
  timeTodaySeconds: number;

  @ApiProperty({
    description: 'Exact study time in the last seven Vietnam dates, in seconds',
  })
  time7DaysSeconds: number;

  @ApiProperty({ description: 'Exact lifetime study time, in seconds' })
  timeTotalSeconds: number;

  @ApiProperty({
    type: [Number],
    description: 'Seven daily study totals in seconds',
  })
  chart7DaysSeconds: number[];

  @ApiProperty({
    type: [String],
    description: 'Seven Vietnam civil dates, oldest first',
  })
  chart7Dates: string[];

  @ApiProperty({
    description: 'Days with positive study time within the chart',
  })
  weekDaysStudied: number;

  @ApiProperty({
    description: 'Average seconds per studied day within the chart',
  })
  weekAverageSeconds: number;

  @ApiProperty({
    description:
      'Longest study streak within the chart; excludes attendance-only days',
  })
  weekLongestStreak: number;

  @ApiProperty({
    type: ActivityTimesDto,
    description: 'Lifetime study seconds by activity',
  })
  activityTimes: ActivityTimesDto;

  @ApiProperty({ type: VocabularyStatsDto })
  vocabularyStats: VocabularyStatsDto;

  @ApiProperty({
    example: '2026-10-17',
    description: 'Current Vietnam study date',
  })
  studyDate: string;

  @ApiProperty({
    example: true,
    description: 'Whether the user checked in today',
  })
  checkedInToday: boolean;

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
