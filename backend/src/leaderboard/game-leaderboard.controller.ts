import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveGuard } from '../auth/guards/active.guard';
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';
import { GameLeaderboardQueryDto } from './game-leaderboard.dto';
import { GameLeaderboardService } from './game-leaderboard.service';

@ApiTags('Leaderboard')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), ActiveGuard, RolesGuard)
@Controller({ path: 'leaderboard/game', version: '1' })
export class GameLeaderboardController {
  constructor(private readonly leaderboard: GameLeaderboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Admin: rank players using persisted completed PK matches',
  })
  @ApiOkResponse({
    description:
      'Paginated PK leaderboard and totals. No private question snapshots or answer keys.',
  })
  getLeaderboard(@Query() query: GameLeaderboardQueryDto) {
    return this.leaderboard.getLeaderboard(query);
  }
}
