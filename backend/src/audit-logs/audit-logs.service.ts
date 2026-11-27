import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditLogEntity } from './infrastructure/persistence/relational/entities/audit-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { getStatusLabel, StatusEnum } from '../statuses/statuses.enum';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  record(data: Parameters<AuditLogsService['createLog']>[0]): void {
    void this.createLog(data).catch((error: unknown) => {
      this.logger.error(
        'Failed to record audit log',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async createLog(data: {
    userId?: number | null;
    userName?: string | null;
    userEmail?: string | null;
    userRole?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    oldData?: object | null;
    newData?: object | null;
    changedFields?: string[] | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditLogEntity> {
    const log = this.auditLogRepository.create({
      userId: data.userId || null,
      userName: data.userName || null,
      userEmail: data.userEmail || null,
      userRole: data.userRole || null,
      action: data.action,
      entityType: data.entityType,
      entityId: String(data.entityId),
      summary: data.summary,
      oldData: data.oldData ? { ...data.oldData } : null,
      newData: data.newData ? { ...data.newData } : null,
      changedFields: data.changedFields || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });
    return this.auditLogRepository.save(log);
  }

  async getLogs(params?: {
    search?: string;
    entityType?: string;
    action?: string;
    userId?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 15));
    const skip = (page - 1) * limit;

    const query = this.auditLogRepository.createQueryBuilder('log');

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query
        .withDeleted()
        .leftJoin(
          UserEntity,
          'student',
          'log.entityType = :studentEntityType AND log.entityId = CAST(student.id AS text)',
          { studentEntityType: 'STUDENT' },
        );
      query.andWhere(
        "(LOWER(log.summary) LIKE :term OR LOWER(log.userName) LIKE :term OR LOWER(log.userEmail) LIKE :term OR log.entityId LIKE :term OR ('#' || CAST(student.studentCode AS text)) LIKE :term)",
        { term },
      );
    }

    if (params?.entityType && params.entityType !== 'ALL') {
      query.andWhere('log.entityType = :entityType', {
        entityType: params.entityType,
      });
    }

    if (params?.action && params.action !== 'ALL') {
      query.andWhere('log.action = :action', { action: params.action });
    }

    if (params?.userId) {
      query.andWhere('log.userId = :userId', { userId: params.userId });
    }

    query.orderBy('log.createdAt', 'DESC').addOrderBy('log.id', 'DESC');
    query.skip(skip).take(limit);

    const [items, total] = await query.getManyAndCount();

    // entityId identifies the account; the student code is its public identifier.
    // Resolve one page in a single query, including accounts that were soft-deleted.
    const studentIds = [
      ...new Set(
        items
          .filter((item) => item.entityType === 'STUDENT')
          .map((item) => Number(item.entityId))
          .filter((id) => Number.isInteger(id) && id > 0 && id <= 2147483647),
      ),
    ];
    const students = studentIds.length
      ? await this.auditLogRepository.manager.getRepository(UserEntity).find({
          select: { id: true, studentCode: true },
          where: { id: In(studentIds) },
          withDeleted: true,
          loadEagerRelations: false,
        })
      : [];
    const studentCodes = new Map(
      students.map((student) => [student.id, student.studentCode]),
    );
    const data = items.map((item) => {
      const summary = this.getStatusChangeSummary(item);
      const log = summary === item.summary ? item : { ...item, summary };
      return item.entityType === 'STUDENT'
        ? {
            ...log,
            studentCode: studentCodes.get(Number(item.entityId)) ?? null,
          }
        : log;
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private getStatusChangeSummary(log: AuditLogEntity): string {
    const missingStatus = /thành\s+undefined\s*$/u;
    if (log.action !== 'STATUS_CHANGE' || !missingStatus.test(log.summary)) {
      return log.summary;
    }

    const storedStatus = log.newData?.status;
    const statusRecord =
      storedStatus &&
      typeof storedStatus === 'object' &&
      !Array.isArray(storedStatus)
        ? (storedStatus as Record<string, unknown>)
        : null;
    const statusId =
      log.newData?.statusId ??
      statusRecord?.id ??
      (typeof storedStatus === 'number' ? storedStatus : undefined);
    let label = getStatusLabel(statusId);
    if (label === 'Không xác định') {
      const storedName =
        typeof storedStatus === 'string' ? storedStatus : statusRecord?.name;
      const legacyLabels: Record<string, string> = {
        Active: getStatusLabel(StatusEnum.active),
        Pending: getStatusLabel(StatusEnum.pending),
        Inactive: 'Không hoạt động (nhật ký cũ chưa lưu mã trạng thái)',
        'Đã duyệt': getStatusLabel(StatusEnum.active),
        'Đã hủy': getStatusLabel(StatusEnum.inactive),
        'Đã khóa': 'Đã khóa',
        'Chờ duyệt': getStatusLabel(StatusEnum.pending),
      };
      if (
        typeof storedName === 'string' &&
        Object.prototype.hasOwnProperty.call(legacyLabels, storedName)
      ) {
        label = legacyLabels[storedName];
      }
    }

    return log.summary.replace(
      missingStatus,
      label === 'Không xác định'
        ? '— chưa xác định trạng thái mới (nhật ký cũ thiếu dữ liệu)'
        : `thành ${label}`,
    );
  }

  async getSummaryStats() {
    const totalLogs = await this.auditLogRepository.count();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayLogs = await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :startOfToday', { startOfToday })
      .getCount();

    const mostActive = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.userName', 'userName')
      .addSelect('log.userEmail', 'userEmail')
      .addSelect('COUNT(log.id)', 'count')
      .where('log.userName IS NOT NULL')
      .groupBy('log.userName')
      .addGroupBy('log.userEmail')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne();

    const actionCountsRaw = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(log.id)', 'count')
      .groupBy('log.action')
      .getRawMany();

    const actionBreakdown: Record<string, number> = {};
    actionCountsRaw.forEach((r) => {
      actionBreakdown[r.action] = parseInt(r.count, 10);
    });

    const entityCountsRaw = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.entityType', 'entityType')
      .addSelect('COUNT(log.id)', 'count')
      .groupBy('log.entityType')
      .getRawMany();

    const entityBreakdown: Record<string, number> = {};
    entityCountsRaw.forEach((r) => {
      entityBreakdown[r.entityType] = parseInt(r.count, 10);
    });

    return {
      totalLogs,
      todayLogs,
      mostActiveUser: mostActive ? mostActive.userName : 'Admin',
      actionBreakdown,
      entityBreakdown,
    };
  }
}
