import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { HskQueryDto } from '../utils/dto/content-query.dto';

export class GameLeaderboardQueryDto extends HskQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'week', 'month'], default: 'all' })
  @IsOptional()
  @IsEnum({ all: 'all', week: 'week', month: 'month' })
  timeframe?: 'all' | 'week' | 'month';

  @ApiPropertyOptional({ enum: ['score', 'wins', 'winRate'], default: 'score' })
  @IsOptional()
  @IsEnum({ score: 'score', wins: 'wins', winRate: 'winRate' })
  metric?: 'score' | 'wins' | 'winRate';
}
