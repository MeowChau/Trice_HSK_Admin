import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ParseIntPipe,
  BadRequestException,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PingSessionDto } from './dto/ping-session.dto';
import { VocabularyProgressDto } from './dto/vocabulary-progress.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import {
  RegistrationsQueryDto,
  RegistrationsResponseDto,
} from './dto/registrations-response.dto';
import { HskDistributionResponseDto } from './dto/hsk-distribution-response.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';
import { ContentEditor } from '../roles/content-editor.decorator';
import type { RequestWithUser } from '../utils/types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard)
@Controller({
  path: 'analytics',
  version: '1',
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({
    summary: 'Get learning statistics dashboard for current user',
  })
  @ApiOkResponse({
    type: DashboardResponseDto,
    description: 'Dashboard statistics',
  })
  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  getDashboard(@Request() req: RequestWithUser<JwtPayloadType>) {
    return this.analyticsService.getDashboard(Number(req.user.id));
  }

  @ApiOperation({
    summary:
      'Thống kê đăng ký theo khoảng ngày (giờ Việt Nam); mặc định 6 tháng hiện tại nếu không lọc.',
  })
  @ApiOkResponse({
    type: RegistrationsResponseDto,
    description: 'Registration statistics for charts',
  })
  @ContentEditor()
  @Get('registrations')
  @HttpCode(HttpStatus.OK)
  getRegistrations(@Query() query: RegistrationsQueryDto = {}) {
    return this.analyticsService.getRegistrations(query);
  }

  @ApiOperation({
    summary: 'Số đề thi được tạo theo tháng trong năm, giờ Việt Nam',
  })
  @ApiQuery({ name: 'year', required: false, type: Number, example: 2026 })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['year', 'monthlyCounts', 'total'],
      properties: {
        year: { type: 'integer', example: 2026 },
        monthlyCounts: {
          type: 'array',
          minItems: 12,
          maxItems: 12,
          items: { type: 'integer', minimum: 0 },
          description: 'Thứ tự từ tháng 1 đến tháng 12; không tính đề đã xóa.',
        },
        total: { type: 'integer', minimum: 0 },
      },
    },
  })
  @ContentEditor()
  @Get('monthly-exams')
  @HttpCode(HttpStatus.OK)
  getMonthlyExams(
    @Query(
      'year',
      new ParseIntPipe({
        optional: true,
        exceptionFactory: () =>
          new BadRequestException('Năm phải là số nguyên từ 1900 đến 2100.'),
      }),
    )
    year?: number,
  ) {
    return this.analyticsService.getMonthlyExams(year);
  }

  @ApiOperation({ summary: 'Get current and target HSK level distribution' })
  @ApiOkResponse({
    type: HskDistributionResponseDto,
    description: 'HSK level distribution for charts',
  })
  @ContentEditor()
  @Get('hsk-distribution')
  @HttpCode(HttpStatus.OK)
  getHskDistribution() {
    return this.analyticsService.getHskDistribution();
  }

  @ApiOperation({ summary: 'Get daily study time distribution' })
  @ApiOkResponse({ description: 'Daily study time distribution' })
  @ContentEditor()
  @Get('daily-study-time-distribution')
  @HttpCode(HttpStatus.OK)
  getDailyStudyTimeDistribution() {
    return this.analyticsService.getDailyStudyTimeDistribution();
  }

  @ApiOperation({ summary: 'Log a study session ping' })
  @ApiCreatedResponse({
    description: 'The study session ping has been successfully logged',
  })
  @Post('ping')
  @HttpCode(HttpStatus.CREATED)
  pingSession(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Body() pingDto: PingSessionDto,
  ) {
    return this.analyticsService.ping(
      Number(req.user.id),
      pingDto.durationInSeconds,
      pingDto.module,
    );
  }

  @ApiOperation({
    summary: 'Record the current user vocabulary learning progress',
  })
  @Post('vocabulary-progress')
  @HttpCode(HttpStatus.OK)
  recordVocabularyProgress(
    @Request() req: RequestWithUser<JwtPayloadType>,
    @Body() dto: VocabularyProgressDto,
  ) {
    return this.analyticsService.recordVocabularyProgress(
      Number(req.user.id),
      dto,
    );
  }

  @ApiOperation({
    summary: 'Get teacher statistics and metrics for admin dashboard',
  })
  @ApiOkResponse({ description: 'Teacher statistics metrics' })
  @ContentEditor()
  @Get('teacher-stats')
  @HttpCode(HttpStatus.OK)
  getTeacherStats() {
    return this.analyticsService.getTeacherStats();
  }
}
