import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { ActiveGuard } from '../auth/guards/active.guard';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { ExamPaymentsService } from './exam-payments.service';

@ApiTags('Exam payments')
@Controller({ path: 'exam-payments', version: '1' })
export class ExamPaymentsController {
  constructor(private readonly payments: ExamPaymentsService) {}

  @Post('exams/:examId/checkout')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  checkout(
    @Param('examId', ParseIntPipe) examId: number,
    @Request() request: RequestWithUser<JwtPayloadType>,
  ) {
    return this.payments.checkout(examId, request.user);
  }

  @Get(':paymentId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), ActiveGuard, ThrottlerGuard)
  @Header('Cache-Control', 'private, no-store')
  status(
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Request() request: RequestWithUser<JwtPayloadType>,
  ) {
    return this.payments.status(paymentId, Number(request.user.id));
  }

  @Post('payos/webhook')
  @SkipThrottle()
  @HttpCode(200)
  webhook(@Body() body: unknown) {
    return this.payments.webhook(body);
  }
}
