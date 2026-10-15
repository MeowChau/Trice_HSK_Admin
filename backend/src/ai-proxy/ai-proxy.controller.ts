import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
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

@ApiTags('AI Proxy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
@Controller('ai')
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('speaking/pronunciation-assessment')
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
  evaluatePronunciation(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: PronunciationAssessmentDto,
  ) {
    return this.aiProxyService.evaluatePronunciation(file, data.referenceText);
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
