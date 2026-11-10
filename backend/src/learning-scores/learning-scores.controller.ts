import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Param,
  ParseUUIDPipe,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { LearningScoresService } from './learning-scores.service';
import {
  SubmitLearningScoreDto,
  ScoreLevelQueryDto,
  LearningHistoryQueryDto,
} from './learning-score.dto';
@ApiTags('Learning scores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
@Controller({ path: 'learning-scores', version: '1' })
export class LearningScoresController {
  constructor(private readonly scores: LearningScoresService) {}
  @Get('history')
  history(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Query() query: LearningHistoryQueryDto,
  ) {
    return this.scores.history(Number(req.user.id), query);
  }
  @Get('history/:historyId')
  detail(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Param('historyId', new ParseUUIDPipe()) historyId: string,
  ) {
    return this.scores.historyDetail(Number(req.user.id), historyId);
  }
  @Get()
  summary(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Query() query: ScoreLevelQueryDto,
  ) {
    return this.scores.summary(
      Number(req.user.id),
      query.hskLevel ? Number(query.hskLevel) : undefined,
    );
  }
  @Post('submit')
  @HttpCode(200)
  submit(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Body() dto: SubmitLearningScoreDto,
  ) {
    return this.scores.submit(Number(req.user.id), dto);
  }
}
