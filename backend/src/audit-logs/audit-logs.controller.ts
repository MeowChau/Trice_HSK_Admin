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
import { Roles } from '../roles/roles.decorator';
import { RolesGuard } from '../roles/roles.guard';
import { RoleEnum } from '../roles/roles.enum';
import { AuditLogQueryDto } from '../utils/dto/content-query.dto';

@ApiTags('AuditLogs')
@ApiBearerAuth()
@Roles(RoleEnum.admin)
@UseGuards(AuthGuard('jwt'), ActiveGuard, RolesGuard)
@Controller({
  path: 'audit-logs',
  version: '1',
})
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @ApiOperation({
    summary: 'Get audit logs list with search, filter, and pagination',
  })
  @ApiOkResponse({ description: 'List of audit logs' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @HttpCode(HttpStatus.OK)
  getLogs(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.getLogs(query);
  }

  @ApiOperation({ summary: 'Get summary statistics for audit logs' })
  @ApiOkResponse({ description: 'Summary KPI statistics' })
  @Get('summary')
  @HttpCode(HttpStatus.OK)
  getSummaryStats() {
    return this.auditLogsService.getSummaryStats();
  }
}
