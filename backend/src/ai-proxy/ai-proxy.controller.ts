import { LearningScoresService } from '../learning-scores/learning-scores.service';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
  Version,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AiProxyService } from './ai-proxy.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  PronunciationAssessmentDto,
  WritingAssessmentDto,
} from './dto/assessment.dto';
import type { SpeechAttemptContext } from '../learning-scores/history-types';

@ApiTags('AI Proxy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
@Controller('ai')
export class AiProxyController {
  constructor(
    private readonly aiProxyService: AiProxyService,
    private readonly learningScores: LearningScoresService,
  ) {}

  @Post('speaking/pronunciation-assessment')
  @Version('1')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        audio: {
          type: 'string',
          format: 'binary',
        },
        referenceText: {
          type: 'string',
        },
      },
    },
  })
  async evaluatePronunciation(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: PronunciationAssessmentDto,
    @Request() req: RequestWithUser<JwtPayloadType>,
  ) {
    const question = data.questionId
      ? await this.learningScores.speechQuestion(
          Number(data.questionId),
          data.referenceText,
        )
      : null;
    let context: SpeechAttemptContext | undefined;
    let requestToken: string | undefined;
    if (
      data.attemptId !== undefined ||
      data.kind !== undefined ||
      data.sourceId !== undefined
    ) {
      const sourceId = Number(data.sourceId);
      if (
        !question ||
        !data.attemptId ||
        !data.kind ||
        !Number.isInteger(sourceId) ||
        sourceId <= 0 ||
        sourceId > 2147483647
      )
        throw new BadRequestException(
          'Cần đủ mã câu, mã lượt và bài nguồn để lưu lịch sử luyện nói.',
        );
      context = { attemptId: data.attemptId, kind: data.kind, sourceId };
      requestToken = await this.learningScores.prepareSpeechAttempt(
        Number(req.user.id),
        question,
        context,
      );
    }
    const assessment = await this.aiProxyService.evaluatePronunciation(
      file,
      data.referenceText,
    );
    if (!question) return assessment;
    try {
      await this.learningScores.recordPronunciation(
        Number(req.user.id),
        question,
        assessment,
        context,
        requestToken,
      );
      return { ...assessment, progressSaved: true };
    } catch {
      return {
        ...assessment,
        progressSaved: false,
        progressMessage:
          'Đã chấm phát âm nhưng chưa lưu được điểm tổng hợp. Hãy thử lại sau khi backend được cập nhật.',
      };
    }
  }

  @Post('writing-assessment')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        questionId: { type: 'string' },
        userText: { type: 'string' },
        hskLevel: { type: 'number' },
      },
    },
  })
  evaluateWriting(@Body() data: WritingAssessmentDto) {
    return this.aiProxyService.evaluateWriting(
      data.questionId,
      data.userText,
      data.hskLevel,
    );
  }
}
