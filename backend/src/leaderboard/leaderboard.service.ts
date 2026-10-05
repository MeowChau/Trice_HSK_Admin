import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(StudySessionLogEntity)
    private readonly studySessionLogRepository: Repository<StudySessionLogEntity>,
  ) {}

  async getStreakLeaderboard(params?: {
    hskLevel?: number;
    timeframe?: 'all' | 'month' | 'week';
    limit?: number;
  }) {
    const hskLevel = params?.hskLevel ? Number(params.hskLevel) : undefined;
    const timeframe = params?.timeframe || 'all';
    const limit = params?.limit ? Number(params.limit) : 100;

    // Timeframe date boundary
    const now = new Date();
    let timeframeCondition = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (timeframe === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      timeframeCondition = `WHERE "studyDate" >= $${paramIndex}`;
      queryParams.push(startOfMonth);
      paramIndex++;
    } else if (timeframe === 'week') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      timeframeCondition = `WHERE "studyDate" >= $${paramIndex}`;
      queryParams.push(sevenDaysAgo);
      paramIndex++;
    }

    // 1. Calculate streak metrics using CTE
    const streakSql = `
      WITH filtered_logs AS (
        SELECT "userId", "studyDate"::date as s_date, "durationInSeconds"
        FROM study_session_log
        ${timeframeCondition}
      ),
      user_dates AS (
        SELECT DISTINCT "userId", s_date
        FROM filtered_logs
      ),
      ranked_dates AS (
        SELECT
          "userId",
          s_date,
          s_date - (DENSE_RANK() OVER (PARTITION BY "userId" ORDER BY s_date) * INTERVAL '1 day') AS grp
        FROM user_dates
      ),
      streak_groups AS (
        SELECT
          "userId",
          COUNT(*) as streak_length,
          MIN(s_date) as start_date,
          MAX(s_date) as end_date
        FROM ranked_dates
        GROUP BY "userId", grp
      ),
      user_totals AS (
        SELECT
          "userId",
          COUNT(DISTINCT s_date) as total_days,
          SUM("durationInSeconds") as total_seconds,
          MAX(s_date) as last_study_date
        FROM filtered_logs
        GROUP BY "userId"
      )
      SELECT
        u.id as "userId",
        COALESCE(MAX(sg.streak_length), 0)::int as "longestStreak",
        COALESCE(MAX(CASE WHEN sg.end_date >= CURRENT_DATE - INTERVAL '1 day' THEN sg.streak_length ELSE 0 END), 0)::int as "currentStreak",
        COALESCE(ut.total_days, 0)::int as "totalDays",
        COALESCE(ut.total_seconds, 0)::bigint as "totalSeconds",
        ut.last_study_date::text as "lastStudyDate"
      FROM "user" u
      LEFT JOIN streak_groups sg ON u.id = sg."userId"
      LEFT JOIN user_totals ut ON u.id = ut."userId"
      WHERE u."roleId" = 2 AND u."deletedAt" IS NULL
      GROUP BY u.id, ut.total_days, ut.total_seconds, ut.last_study_date;
    `;

    const streakRows: Array<{
      userId: number;
      longestStreak: number;
      currentStreak: number;
      totalDays: number;
      totalSeconds: string | number;
      lastStudyDate: string | null;
    }> = await this.userRepository.query(streakSql, queryParams);

    const streakMap = new Map<number, typeof streakRows[0]>();
    streakRows.forEach((row) => streakMap.set(Number(row.userId), row));

    // 2. Fetch users with relations
    const userQuery = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.photo', 'photo')
      .leftJoinAndSelect('user.status', 'status')
      .where('user.roleId = :roleId', { roleId: 2 })
      .andWhere('user.deletedAt IS NULL');

    if (hskLevel && hskLevel >= 1 && hskLevel <= 9) {
      userQuery.andWhere(
        '(user.targetHskLevel = :hskLevel OR user.currentHskLevel = :hskLevel)',
        { hskLevel },
      );
    }

    const students = await userQuery.getMany();

    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    // Combine user details with streak metrics
    const leaderboard = students.map((student) => {
      const stats = streakMap.get(student.id);
      const currentStreak = stats ? stats.currentStreak : 0;
      const longestStreak = stats ? stats.longestStreak : 0;
      const totalDays = stats ? stats.totalDays : 0;
      const totalSeconds = stats ? Number(stats.totalSeconds) || 0 : 0;
      const lastStudyDate = stats ? stats.lastStudyDate : null;

      let streakStatus: 'active' | 'warning' | 'lost' = 'lost';
      if (lastStudyDate === todayStr) {
        streakStatus = 'active'; // Studied today 🔥
      } else if (lastStudyDate === yesterdayStr) {
        streakStatus = 'warning'; // Studied yesterday, need to study today ⚠️
      }

      let avatarPath: string | null = null;
      if (student.photo?.path) {
        avatarPath = student.photo.path.replace(/\\/g, '/');
      }

      return {
        id: student.id,
        fullName:
          student.fullName ||
          student.firstName ||
          student.username ||
          `Học viên #${student.studentCode || student.id}`,
        email: student.email || student.username,
        studentCode: student.studentCode || null,
        avatarFrame: student.avatarFrame || null,
        level: student.level || 1,
        currentExp: student.currentExp || 0,
        targetHskLevel: student.targetHskLevel || null,
        currentHskLevel: student.currentHskLevel || null,
        photo: avatarPath ? { id: student.photo?.id, path: avatarPath } : null,
        currentStreak,
        longestStreak,
        totalDays,
        totalHours: parseFloat((totalSeconds / 3600).toFixed(1)),
        lastStudyDate,
        streakStatus,
      };
    });

    // Default sort by currentStreak DESC, then longestStreak DESC, then totalDays DESC, then level DESC
    leaderboard.sort((a, b) => {
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }
      if (b.longestStreak !== a.longestStreak) {
        return b.longestStreak - a.longestStreak;
      }
      if (b.totalDays !== a.totalDays) {
        return b.totalDays - a.totalDays;
      }
      return b.level - a.level;
    });

    const paginatedLeaderboard = leaderboard.slice(0, limit);

    // 3. Compute KPI Summaries
    const allTimeRecord = leaderboard.reduce(
      (max, item) => Math.max(max, item.longestStreak),
      0,
    );
    const topStreakItem = leaderboard[0];
    const topStreak = topStreakItem ? topStreakItem.currentStreak : 0;
    const topStreakUser =
      topStreak > 0 && topStreakItem ? topStreakItem.fullName : null;
    const activeStreaksCount = leaderboard.filter(
      (item) => item.currentStreak > 0,
    ).length;
    const totalStudyHours = parseFloat(
      leaderboard
        .reduce((sum, item) => sum + item.totalHours, 0)
        .toFixed(1),
    );

    return {
      summary: {
        topStreak,
        topStreakUser,
        allTimeRecord,
        activeStreaksCount,
        totalStudents: students.length,
        totalStudyHours,
      },
      leaderboard: paginatedLeaderboard,
    };
  }
}
