import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PingSessionDto } from './dto/ping-session.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { RegistrationsResponseDto } from './dto/registrations-response.dto';
import { HskDistributionResponseDto } from './dto/hsk-distribution-response.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';

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
  getDashboard(@Request() req: any) {
    return this.analyticsService.getDashboard(req.user.id);
  }

  @ApiOperation({
    summary:
      'Get user registration statistics (students and teachers) for the current 6-month period',
  })
  @ApiOkResponse({
    type: RegistrationsResponseDto,
    description: 'Registration statistics for charts',
  })
  @Get('registrations')
  @HttpCode(HttpStatus.OK)
  getRegistrations() {
    return this.analyticsService.getRegistrations();
  }

  @ApiOperation({ summary: 'Get current and target HSK level distribution' })
  @ApiOkResponse({
    type: HskDistributionResponseDto,
    description: 'HSK level distribution for charts',
  })
  @Get('hsk-distribution')
  @HttpCode(HttpStatus.OK)
  getHskDistribution() {
    return this.analyticsService.getHskDistribution();
  }

  @ApiOperation({ summary: 'Get daily study time distribution' })
  @ApiOkResponse({ description: 'Daily study time distribution' })
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
  pingSession(@Request() req: any, @Body() pingDto: PingSessionDto) {
    return this.analyticsService.ping(
      req.user.id,
      pingDto.durationInSeconds,
      pingDto.module,
    );
  }

  @ApiOperation({ summary: 'Get teacher statistics and metrics for admin dashboard' })
  @ApiOkResponse({ description: 'Teacher statistics metrics' })
  @Get('teacher-stats')
  @HttpCode(HttpStatus.OK)
  getTeacherStats() {
    return this.analyticsService.getTeacherStats();
  }
}
