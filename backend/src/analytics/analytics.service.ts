import { databaseDate, studyDate } from '../utils/study-date';
import { aggregateContent, recentMonths } from './content-counts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { PracticeSetEntity } from '../practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import {
  GamificationService,
  totalExperience,
} from '../gamification/gamification.service';
import { VocabularyProgressDto } from './dto/vocabulary-progress.dto';

const CHECK_IN_MODULE = 'daily_checkin';
const DAILY_CHECK_IN_EXP = 10;

const publicStudyLog = (log: StudySessionLogEntity) => ({
  id: log.id,
  studyDate: log.studyDate,
  durationInSeconds: log.durationInSeconds,
  module: log.module,
  createdAt: log.createdAt,
  updatedAt: log.updatedAt,
});

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(StudySessionLogEntity)
    private readonly studySessionLogRepository: Repository<StudySessionLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    @InjectRepository(ExamEntity)
    private readonly examRepository: Repository<ExamEntity>,
    @InjectRepository(PracticeSetEntity)
    private readonly practiceSetRepository: Repository<PracticeSetEntity>,
    private readonly gamificationService: GamificationService,
  ) {}

  async ping(userId: number, durationInSeconds: number, module: string) {
    if (module === CHECK_IN_MODULE) return this.checkIn(userId);
    const today = studyDate();
    const log = this.studySessionLogRepository.create({
      studyDate: today,
      durationInSeconds,
      module,
      user: { id: userId } as UserEntity,
    });
    return publicStudyLog(await this.studySessionLogRepository.save(log));
  }

  async recordVocabularyProgress(userId: number, dto: VocabularyProgressDto) {
    const status =
      dto.action === 'remembered'
        ? 'remembered'
        : dto.action === 'unknown'
          ? 'needs_review'
          : 'learning';
    // One row per account and word. Practising writing alone must not change
    // the user's own remembered/unknown assessment or increment word counts.
    const rows = await this.studySessionLogRepository.query<
      {
        vocabularyId: number;
        status: string;
        lastStudiedAt: Date;
      }[]
    >(
      `
      INSERT INTO "vocabulary_progress" ("userId", "vocabularyId", "status")
      SELECT $1, id, $3 FROM "vocabulary" WHERE id = $2
      ON CONFLICT ("userId", "vocabularyId") DO UPDATE SET
        "status" = CASE WHEN $4 = 'studied' THEN "vocabulary_progress"."status" ELSE EXCLUDED."status" END,
        "lastStudiedAt" = now(), "updatedAt" = now()
      RETURNING "vocabularyId", "status", "lastStudiedAt"
    `,
      [userId, dto.vocabularyId, status, dto.action],
    );
    if (!rows.length) throw new NotFoundException('Vocabulary not found');
    return rows[0];
  }

  private checkIn(userId: number) {
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await manager
        .getRepository(UserEntity)
        .createQueryBuilder('user')
        .select(['user.id', 'user.level', 'user.currentExp'])
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!user) throw new NotFoundException('User not found');

      // Check the Vietnam day after acquiring the shared user lock. Concurrent
      // devices and timeout retries must see the first committed check-in.
      const today = studyDate();
      const logs = manager.getRepository(StudySessionLogEntity);
      const previous = await logs.findOne({
        where: {
          user: { id: userId },
          studyDate: today,
          module: CHECK_IN_MODULE,
        },
        loadEagerRelations: false,
        order: { id: 'ASC' },
      });
      if (previous) {
        // Existing attendance predates EXP rewards: preserve it without
        // retroactively crediting points or leaking its eager user relation.
        return {
          ...publicStudyLog(previous),
          alreadyCheckedIn: true,
          expAwarded: 0,
          level: user.level,
          currentExp: user.currentExp,
          totalExp: totalExperience(user),
        };
      }

      const log = await logs.save(
        logs.create({
          user: { id: userId } as UserEntity,
          studyDate: today,
          module: CHECK_IN_MODULE,
          durationInSeconds: 0,
        }),
      );
      const reward = await this.gamificationService.awardOnce(
        manager,
        userId,
        'daily_checkin',
        today,
        DAILY_CHECK_IN_EXP,
        { studyDate: today, studySessionLogId: log.id },
      );
      return {
        ...publicStudyLog(log),
        ...reward,
        alreadyCheckedIn: reward.expAwarded === 0,
      };
    });
  }

  async getDashboard(userId: number) {
    const now = new Date();
    const today = studyDate(now);
    const last7Dates = Array.from({ length: 7 }, (_, index) =>
      studyDate(new Date(now.getTime() - (6 - index) * 86400000)),
    );
    const sevenDaysAgo = last7Dates[0];
    const totalsPromise = this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('COALESCE(SUM(log.durationInSeconds), 0)', 'timeTotal')
      .addSelect(
        'COALESCE(SUM(log.durationInSeconds) FILTER (WHERE log.studyDate = :today), 0)',
        'timeToday',
      )
      .addSelect(
        'COALESCE(SUM(log.durationInSeconds) FILTER (WHERE log.studyDate BETWEEN :sevenDaysAgo AND :today), 0)',
        'time7Days',
      )
      .addSelect('COUNT(DISTINCT log.studyDate)', 'totalDays')
      .where('log.userId = :userId', { userId, today, sevenDaysAgo })
      .andWhere('log.studyDate <= :today')
      .andWhere('log.module <> :checkInModule AND log.durationInSeconds > 0', {
        checkInModule: CHECK_IN_MODULE,
      })
      .getRawOne<{
        timeTotal: string;
        timeToday: string;
        time7Days: string;
        totalDays: string;
      }>();
    const chartPromise = this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('log.studyDate', 'date')
      .addSelect('SUM(log.durationInSeconds)', 'duration')
      .where(
        'log.userId = :userId AND log.studyDate BETWEEN :sevenDaysAgo AND :today',
        { userId, sevenDaysAgo, today },
      )
      .andWhere('log.module <> :checkInModule AND log.durationInSeconds > 0', {
        checkInModule: CHECK_IN_MODULE,
      })
      .groupBy('log.studyDate')
      .orderBy('log.studyDate', 'ASC')
      .getRawMany<{ date: string | Date; duration: string }>();

    // Longest Streak Logic (PostgreSQL)
    // Fixed: Use DISTINCT "studyDate"::date in CTE to avoid same-day pings breaking the streak
    const streakQuery = `
      WITH unique_dates AS (
        SELECT DISTINCT "studyDate"::date as s_date
        FROM study_session_log
        WHERE "userId" = $1 AND "module" <> $2
          AND "durationInSeconds" > 0 AND "studyDate" <= $3
      ),
      groups AS (
        SELECT
          s_date,
          s_date - (ROW_NUMBER() OVER (ORDER BY s_date) * INTERVAL '1 day') AS grp
        FROM unique_dates
      )
      SELECT COUNT(*) as streak
      FROM groups
      GROUP BY grp
      ORDER BY streak DESC
      LIMIT 1;
    `;
    const activityPromise = this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('log.module', 'module')
      .addSelect('SUM(log.durationInSeconds)', 'duration')
      .where('log.userId = :userId AND log.studyDate <= :today', {
        userId,
        today,
      })
      .andWhere('log.module <> :checkInModule AND log.durationInSeconds > 0', {
        checkInModule: CHECK_IN_MODULE,
      })
      .groupBy('log.module')
      .getRawMany<{ module: string; duration: string }>();
    const vocabularyPromise = this.studySessionLogRepository.query<
      {
        status: string;
        count: string;
      }[]
    >(
      `SELECT status, COUNT(*) AS count FROM "vocabulary_progress" WHERE "userId" = $1 GROUP BY status`,
      [userId],
    );
    const [
      totals,
      chartRows,
      streakResult,
      checkedInToday,
      activityRows,
      vocabularyRows,
    ] = await Promise.all([
      totalsPromise,
      chartPromise,
      this.studySessionLogRepository.query(streakQuery, [
        userId,
        CHECK_IN_MODULE,
        today,
      ]),
      this.studySessionLogRepository.existsBy({
        user: { id: userId },
        studyDate: today,
        module: CHECK_IN_MODULE,
      }),
      activityPromise,
      vocabularyPromise,
    ]);
    const chartMap = new Map(
      chartRows.map((row) => [databaseDate(row.date), Number(row.duration)]),
    );
    const chart7DaysSeconds = last7Dates.map((date) => chartMap.get(date) || 0);
    const chart7Days = chart7DaysSeconds.map((seconds) => seconds / 3600);
    const weekDaysStudied = chart7DaysSeconds.filter(
      (seconds) => seconds > 0,
    ).length;
    let weekLongestStreak = 0;
    let weekStreak = 0;
    for (const seconds of chart7DaysSeconds) {
      weekStreak = seconds > 0 ? weekStreak + 1 : 0;
      weekLongestStreak = Math.max(weekLongestStreak, weekStreak);
    }
    const activityTimes = { review: 0, practice: 0, exam: 0, pk: 0 };
    const activityModules: Record<string, keyof typeof activityTimes> = {
      vocabulary_review: 'review',
      practice_listening: 'practice',
      practice_reading: 'practice',
      practice_speaking: 'practice',
      practice_writing: 'practice',
      hsk_exam: 'exam',
      game_battle: 'pk',
    };
    for (const row of activityRows) {
      const key = Object.prototype.hasOwnProperty.call(
        activityModules,
        row.module,
      )
        ? activityModules[row.module]
        : undefined;
      if (key) activityTimes[key] += Number(row.duration);
    }
    const wordCounts = new Map(
      vocabularyRows.map((row) => [row.status, Number(row.count)]),
    );
    const masteredCount = wordCounts.get('remembered') || 0;
    const reviewCount = wordCounts.get('needs_review') || 0;
    const learningCount = (wordCounts.get('learning') || 0) + reviewCount;
    const timeTotalSeconds = Number(totals?.timeTotal || 0);
    const totalDaysStudied = Number(totals?.totalDays || 0);
    const averagePerDay =
      totalDaysStudied > 0 ? timeTotalSeconds / totalDaysStudied : 0;
    const longestStreak = streakResult[0]?.streak
      ? parseInt(streakResult[0].streak)
      : 0;

    const timeToday = parseFloat(
      (Number(totals?.timeToday || 0) / 3600).toFixed(1),
    );
    const time7Days = parseFloat(
      (Number(totals?.time7Days || 0) / 3600).toFixed(1),
    );
    const timeTotal = parseFloat((timeTotalSeconds / 3600).toFixed(1));
    const averagePerDayHours = parseFloat((averagePerDay / 3600).toFixed(1));

    return {
      studyDate: today,
      checkedInToday,
      timeZone: 'Asia/Ho_Chi_Minh',
      timeTodaySeconds: Number(totals?.timeToday || 0),
      time7DaysSeconds: Number(totals?.time7Days || 0),
      timeTotalSeconds,
      chart7DaysSeconds,
      chart7Dates: last7Dates,
      weekDaysStudied,
      weekAverageSeconds:
        weekDaysStudied > 0
          ? chart7DaysSeconds.reduce((sum, seconds) => sum + seconds, 0) /
            weekDaysStudied
          : 0,
      weekLongestStreak,
      activityTimes,
      vocabularyStats: {
        learnedCount: masteredCount + learningCount,
        masteredCount,
        learningCount,
        reviewCount,
      },
      timeToday,
      time7Days,
      timeTotal,
      chart7Days,
      totalDaysStudied,
      averagePerDay: averagePerDayHours,
      longestStreak,
    };
  }

  async getRegistrations() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // 1-12
    const startMonth = month <= 6 ? 1 : 7;
    const endMonth = month <= 6 ? 6 : 12;

    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('EXTRACT(MONTH FROM user.createdAt)', 'month')
      .addSelect('user.roleId', 'roleId')
      .addSelect('COUNT(user.id)', 'count')
      .where('EXTRACT(YEAR FROM user.createdAt) = :year', { year })
      .andWhere(
        'EXTRACT(MONTH FROM user.createdAt) >= :startMonth AND EXTRACT(MONTH FROM user.createdAt) <= :endMonth',
        { startMonth, endMonth },
      )
      .groupBy('EXTRACT(MONTH FROM user.createdAt)')
      .addGroupBy('user.roleId')
      .getRawMany();

    const newUsers = Array(6).fill(0);
    const newTeachers = Array(6).fill(0);

    result.forEach((row) => {
      const monthIdx = parseInt(row.month) - startMonth;
      if (monthIdx >= 0 && monthIdx < 6) {
        if (row.roleId === 2) {
          newUsers[monthIdx] = parseInt(row.count) || 0;
        } else if (row.roleId === 3) {
          newTeachers[monthIdx] = parseInt(row.count) || 0;
        }
      }
    });

    return {
      startMonth,
      endMonth,
      newUsers,
      newTeachers,
    };
  }

  async getHskDistribution() {
    const currentHskResult = await this.userRepository
      .createQueryBuilder('user')
      .select('user.currentHskLevel', 'level')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.currentHskLevel IS NOT NULL')
      .groupBy('user.currentHskLevel')
      .getRawMany();

    const targetHskResult = await this.userRepository
      .createQueryBuilder('user')
      .select('user.targetHskLevel', 'level')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.targetHskLevel IS NOT NULL')
      .groupBy('user.targetHskLevel')
      .getRawMany();

    const currentHsk = Array(9).fill(0);
    const targetHsk = Array(9).fill(0);

    currentHskResult.forEach((row) => {
      const level = parseInt(row.level);
      if (level >= 1 && level <= 9) {
        currentHsk[level - 1] = parseInt(row.count) || 0;
      }
    });

    targetHskResult.forEach((row) => {
      const level = parseInt(row.level);
      if (level >= 1 && level <= 9) {
        targetHsk[level - 1] = parseInt(row.count) || 0;
      }
    });

    return {
      currentHsk,
      targetHsk,
    };
  }

  async getDailyStudyTimeDistribution() {
    const result = await this.userRepository
      .createQueryBuilder('user')
      .select('user.dailyStudyTime', 'time')
      .addSelect('COUNT(user.id)', 'count')
      .where('user.dailyStudyTime IS NOT NULL')
      .groupBy('user.dailyStudyTime')
      .orderBy('user.dailyStudyTime', 'ASC')
      .getRawMany();
    return result.map((row) => ({
      time: parseInt(row.time),
      count: parseInt(row.count),
    }));
  }

  async getTeacherStats() {
    // 1. Overview KPIs
    const now = new Date();
    const months = recentMonths(now);
    const [teachers, questions, exams, practices] = await Promise.all([
      this.userRepository.find({
        where: { role: { id: 3 } },
        relations: ['photo', 'status'],
        order: { createdAt: 'DESC' },
        withDeleted: true,
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          position: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          photo: { id: true, path: true },
          status: { id: true },
        },
      }),
      aggregateContent(this.questionRepository, months, true),
      aggregateContent(this.examRepository, months),
      aggregateContent(this.practiceSetRepository, months),
    ]);
    const totalTeachers = teachers.length;
    const activeTeachers = teachers.filter(
      (t) => t.status?.id === 1 && !t.deletedAt,
    ).length;

    // Growth calculation: teachers created this month vs last month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfThisMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);

    const thisMonthTeachers = teachers.filter(
      (t) => new Date(t.createdAt) >= startOfThisMonth,
    ).length;
    const lastMonthTeachers = teachers.filter(
      (t) =>
        new Date(t.createdAt) >= startOfLastMonth &&
        new Date(t.createdAt) < startOfThisMonth,
    ).length;

    let growthPercentage = 0;
    if (lastMonthTeachers === 0) {
      growthPercentage = thisMonthTeachers > 0 ? 100 : 0;
    } else {
      growthPercentage = Math.round(
        ((thisMonthTeachers - lastMonthTeachers) / lastMonthTeachers) * 100,
      );
    }

    const totalQuestionsContributed = questions.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );
    const totalExamsContributed = [...exams, ...practices].reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );

    // 2. Position Distribution (Donut Chart)
    const b1Count = teachers.filter(
      (t) => (t.position || 'Bậc 1') === 'Bậc 1',
    ).length;
    const b2Count = teachers.filter((t) => t.position === 'Bậc 2').length;
    const positionDonut = {
      labels: ['Bậc 1', 'Bậc 2'],
      counts: [b1Count, b2Count],
      percentages: [
        totalTeachers > 0
          ? Math.round((b1Count / totalTeachers) * 1000) / 10
          : 0,
        totalTeachers > 0
          ? Math.round((b2Count / totalTeachers) * 1000) / 10
          : 0,
      ],
    };

    const timelineCategories = months.map((month) => month.label);
    const questionsSeries = months.map((_, index) =>
      questions
        .filter((row) => Number(row.bucket) === index)
        .reduce((sum, row) => sum + Number(row.count), 0),
    );
    const examsSeries = months.map((_, index) =>
      [...exams, ...practices]
        .filter((row) => Number(row.bucket) === index)
        .reduce((sum, row) => sum + Number(row.count), 0),
    );
    const skillLabels: Record<string, string> = {
      LISTENING: 'Nghe',
      READING: 'Đọc',
      WRITING: 'Viết',
      SPEAKING: 'Nói',
    };
    const skillCounts: Record<string, number> = {
      Nghe: 0,
      Đọc: 0,
      Viết: 0,
      Nói: 0,
    };
    const levelCounts: Record<string, number> = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`HSK ${i + 1}`, 0]),
    );
    for (const row of questions) {
      const label = skillLabels[row.skill || ''];
      if (label) skillCounts[label] += Number(row.count);
      if (row.level && row.level >= 1 && row.level <= 6)
        levelCounts[`HSK ${row.level}`] += Number(row.count);
    }

    // 5. Leaderboard / Detail Table
    const leaderboard = teachers.map((t) => {
      let avatarPath: string | null = null;
      if (t.photo?.path) {
        avatarPath = t.photo.path.replace(/\\/g, '/');
      }

      return {
        id: t.id,
        fullName: t.fullName || t.username || 'Giảng viên',
        email: t.email || t.username,
        position: t.position || 'Bậc 1',
        status: {
          id: t.status?.id || 1,
          name: t.status?.id === 2 ? 'Đã hủy' : 'Đang hoạt động',
        },
        photo: avatarPath ? { id: t.photo?.id, path: avatarPath } : null,
        questionsCount: 0,
        examsCount: 0,
        lastActive: t.updatedAt || t.createdAt,
      };
    });

    return {
      overview: {
        totalTeachers,
        activeTeachers,
        growthPercentage,
        totalQuestionsContributed,
        totalExamsContributed,
      },
      positionDistribution: positionDonut,
      productivityTimeline: {
        categories: timelineCategories,
        questionsSeries,
        examsSeries,
      },
      skillsAndLevels: {
        skills: {
          labels: Object.keys(skillCounts),
          counts: Object.values(skillCounts),
        },
        levels: {
          labels: Object.keys(levelCounts),
          counts: Object.values(levelCounts),
        },
      },
      leaderboard,
    };
  }
}
