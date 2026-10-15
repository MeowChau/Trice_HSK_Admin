import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import { HskQueryDto } from '../utils/dto/content-query.dto';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { OfflineGamesService } from './offline-games.service';
import { SubmitOfflineScoreDto } from './dto/submit-offline-score.dto';

@ApiTags('Game Offline')
@Controller({
  path: 'game/offline',
  version: '1',
})
export class OfflineGamesController {
  constructor(private readonly offlineGamesService: OfflineGamesService) {}

  @Get('words')
  @HttpCode(HttpStatus.OK)
  async getWords(@Query() query: HskQueryDto) {
    return this.offlineGamesService.getRandomWords(
      query.hskLevel ?? 1,
      query.limit ?? 50,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submitScore(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Body() submitDto: SubmitOfflineScoreDto,
  ) {
    return this.offlineGamesService.saveScore(
      Number(req.user.id),
      submitDto.score,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard)
  @Get('top-scores')
  @HttpCode(HttpStatus.OK)
  async getTopScores(@Request() req: RequestWithUser<JwtPayloadType>) {
    return this.offlineGamesService.getTopScores(Number(req.user.id));
  }
}
