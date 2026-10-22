import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
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
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

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
    summary:
      'Get student streak or lifetime EXP leaderboard with HSK 1-9 filtering',
  })
  @ApiOkResponse({
    description:
      'Leaderboard data with summary metrics; EXP includes global and current-user ranks',
  })
  @ApiQuery({
    name: 'metric',
    required: false,
    enum: ['streak', 'exp'],
    description: 'Ranking metric; defaults to streak. EXP uses timeframe=all.',
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
  getStreakLeaderboard(
    @Query() query: LeaderboardQueryDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.leaderboardService.getStreakLeaderboard(
      query,
      Number(req.user.id),
    );
  }
}
