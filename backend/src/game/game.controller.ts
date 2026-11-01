import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { PaginationQueryDto } from '../utils/dto/content-query.dto';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import { GameService } from './game.service';

@ApiTags('Game')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard)
@Controller({ path: 'game/pk', version: '1' })
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get the signed-in user’s completed PK matches' })
  getHistory(
    @Query() query: PaginationQueryDto,
    @Req() req: RequestWithUser<JwtPayloadType>,
  ) {
    return this.gameService.getHistory(Number(req.user.id), query);
  }
}
