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

@ApiTags('AI Proxy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
@Controller('ai')
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('speaking/pronunciation-assessment')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
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
    @Body('referenceText') referenceText: string,
  ) {
    return this.aiProxyService.evaluatePronunciation(file, referenceText);
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
  evaluateWriting(
    @Body('questionId') questionId: string,
    @Body('userText') userText: string,
    @Body('hskLevel') hskLevel: number,
  ) {
    return this.aiProxyService.evaluateWriting(questionId, userText, hskLevel);
  }
}
