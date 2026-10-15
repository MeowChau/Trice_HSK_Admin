import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import { LeaderboardQueryDto } from '../utils/dto/content-query.dto';

@ApiTags('Leaderboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard)
@Controller({
  path: 'leaderboard',
  version: '1',
})
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @ApiOperation({
    summary: 'Get student daily streak leaderboard with HSK 1-9 filtering',
  })
  @ApiOkResponse({
    description: 'Streak leaderboard data with summary metrics and rankings',
  })
  @ApiQuery({
    name: 'hskLevel',
    required: false,
    type: Number,
    description: 'Filter by HSK Level (1 to 9)',
  })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['all', 'month', 'week'],
    description: 'Filter time boundary',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of students to return',
  })
  @Get('streak')
  @HttpCode(HttpStatus.OK)
  getStreakLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getStreakLeaderboard(query);
  }
}
