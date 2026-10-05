import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../roles/roles.guard';
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
  async getWords(
    @Query('hskLevel', ParseIntPipe) hskLevel: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const safeLimit = limit > 100 ? 100 : limit;
    return this.offlineGamesService.getRandomWords(hskLevel, safeLimit);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submitScore(
    @Request() req: any,
    @Body() submitDto: SubmitOfflineScoreDto,
  ) {
    return this.offlineGamesService.saveScore(req.user.id, submitDto.score);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('top-scores')
  @HttpCode(HttpStatus.OK)
  async getTopScores(@Request() req: any) {
    return this.offlineGamesService.getTopScores(req.user.id);
  }
}
