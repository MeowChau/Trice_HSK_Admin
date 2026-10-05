import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ActiveGuard } from '../auth/guards/active.guard';

@ApiTags('AuditLogs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), ActiveGuard)
@Controller({
  path: 'audit-logs',
  version: '1',
})
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @ApiOperation({ summary: 'Get audit logs list with search, filter, and pagination' })
  @ApiOkResponse({ description: 'List of audit logs' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @HttpCode(HttpStatus.OK)
  getLogs(
    @Query('search') search?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditLogsService.getLogs({
      search,
      entityType,
      action,
      userId: userId ? Number(userId) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @ApiOperation({ summary: 'Get summary statistics for audit logs' })
  @ApiOkResponse({ description: 'Summary KPI statistics' })
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  getSummaryStats() {
    return this.auditLogsService.getSummaryStats();
  }
}
