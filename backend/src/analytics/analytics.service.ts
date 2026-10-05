import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { PracticeSetEntity } from '../practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';

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
  ) {}

  async ping(userId: number, durationInSeconds: number, module: string) {
    const today = new Date().toISOString().split('T')[0];
    const log = this.studySessionLogRepository.create({
      studyDate: today,
      durationInSeconds,
      module,
      user: { id: userId } as UserEntity,
    });
    return this.studySessionLogRepository.save(log);
  }

  async getDashboard(userId: number) {
    const today = new Date().toISOString().split('T')[0];
    // We want exactly the last 7 days including today (6 days ago to today)
    const sevenDaysAgoDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = sevenDaysAgoDate.toISOString().split('T')[0];

    // Generate array of exactly 7 last dates
    const last7Dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      last7Dates.push(d.toISOString().split('T')[0]);
    }

    // Get timeToday
    const { sum: timeTodayRaw } = await this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.durationInSeconds)', 'sum')
      .where('log.userId = :userId AND log.studyDate = :today', {
        userId,
        today,
      })
      .getRawOne();

    // Get time7Days
    const { sum: time7DaysRaw } = await this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.durationInSeconds)', 'sum')
      .where('log.userId = :userId AND log.studyDate >= :sevenDaysAgo', {
        userId,
        sevenDaysAgo,
      })
      .getRawOne();

    // Get timeTotal
    const { sum: timeTotalRaw } = await this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.durationInSeconds)', 'sum')
      .where('log.userId = :userId', { userId })
      .getRawOne();

    // Chart 7 Days raw data
    const chart7DaysRaw = await this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('log.studyDate', 'date')
      .addSelect('SUM(log.durationInSeconds)', 'duration')
      .where('log.userId = :userId AND log.studyDate >= :sevenDaysAgo', {
        userId,
        sevenDaysAgo,
      })
      .groupBy('log.studyDate')
      .orderBy('log.studyDate', 'ASC')
      .getRawMany();

    // Create a lookup for chart7DaysRaw
    const chartMap = new Map<string, number>();
    chart7DaysRaw.forEach((row) => {
      // row.date could be a Date object or string depending on postgres driver.
      const dateStr =
        typeof row.date === 'string'
          ? row.date
          : row.date.toISOString().split('T')[0];
      chartMap.set(dateStr, parseInt(row.duration) || 0);
    });

    // Map into array of exactly 7 numbers (converted to hours)
    const chart7Days = last7Dates.map((dateStr) => {
      const seconds = chartMap.get(dateStr) || 0;
      return parseFloat((seconds / 3600).toFixed(1));
    });

    // Total days studied
    const { count: totalDaysStudiedRaw } = await this.studySessionLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.studyDate)', 'count')
      .where('log.userId = :userId', { userId })
      .getRawOne();

    const timeTotalSeconds = parseInt(timeTotalRaw) || 0;
    const totalDaysStudied = parseInt(totalDaysStudiedRaw) || 0;
    const averagePerDay =
      totalDaysStudied > 0 ? timeTotalSeconds / totalDaysStudied : 0;

    // Longest Streak Logic (PostgreSQL)
    // Fixed: Use DISTINCT "studyDate"::date in CTE to avoid same-day pings breaking the streak
    const streakQuery = `
      WITH unique_dates AS (
        SELECT DISTINCT "studyDate"::date as s_date
        FROM study_session_log
        WHERE "userId" = $1
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
    const streakResult = await this.studySessionLogRepository.query(
      streakQuery,
      [userId],
    );
    const longestStreak = streakResult[0]?.streak
      ? parseInt(streakResult[0].streak)
      : 0;

    const timeToday = parseFloat(
      ((parseInt(timeTodayRaw) || 0) / 3600).toFixed(1),
    );
    const time7Days = parseFloat(
      ((parseInt(time7DaysRaw) || 0) / 3600).toFixed(1),
    );
    const timeTotal = parseFloat((timeTotalSeconds / 3600).toFixed(1));
    const averagePerDayHours = parseFloat((averagePerDay / 3600).toFixed(1));

    return {
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
    const teachers = await this.userRepository.find({
      where: { role: { id: 3 } },
      relations: ['photo', 'status', 'role'],
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });

    const totalTeachers = teachers.length;
    const activeTeachers = teachers.filter(
      (t) => t.status?.id === 1 && !t.deletedAt,
    ).length;

    // Growth calculation: teachers created this month vs last month
    const now = new Date();
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

    const totalQuestionsContributed = await this.questionRepository.count();
    const totalExams = await this.examRepository.count();
    const totalPracticeSets = await this.practiceSetRepository.count();
    const totalExamsContributed = totalExams + totalPracticeSets;

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

    // 3. Productivity Timeline (Past 6 Months)
    const monthNames = [
      'Thg 1',
      'Thg 2',
      'Thg 3',
      'Thg 4',
      'Thg 5',
      'Thg 6',
      'Thg 7',
      'Thg 8',
      'Thg 9',
      'Thg 10',
      'Thg 11',
      'Thg 12',
    ];
    const timelineCategories: string[] = [];
    const questionsSeries: number[] = [];
    const examsSeries: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const nextD = new Date(currentYear, currentMonth - i + 1, 1);
      const label = monthNames[d.getMonth()];
      timelineCategories.push(label);

      const qInMonth = await this.questionRepository
        .createQueryBuilder('q')
        .where('q.createdAt >= :d AND q.createdAt < :nextD', { d, nextD })
        .getCount();

      const eInMonth = await this.examRepository
        .createQueryBuilder('e')
        .where('e.createdAt >= :d AND e.createdAt < :nextD', { d, nextD })
        .getCount();
      const psInMonth = await this.practiceSetRepository
        .createQueryBuilder('ps')
        .where('ps.createdAt >= :d AND ps.createdAt < :nextD', { d, nextD })
        .getCount();

      questionsSeries.push(qInMonth);
      examsSeries.push(eInMonth + psInMonth);
    }

    // 4. Skills & Levels Distribution
    const rawSkills = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.skill', 'skill')
      .addSelect('COUNT(q.id)', 'count')
      .groupBy('q.skill')
      .getRawMany();

    const skillCounts: Record<string, number> = {
      Nghe: 0,
      Đọc: 0,
      Viết: 0,
      Nói: 0,
    };

    rawSkills.forEach((r) => {
      const s = r.skill?.toUpperCase();
      if (s === 'LISTENING') skillCounts['Nghe'] = parseInt(r.count, 10);
      else if (s === 'READING') skillCounts['Đọc'] = parseInt(r.count, 10);
      else if (s === 'WRITING') skillCounts['Viết'] = parseInt(r.count, 10);
      else if (s === 'SPEAKING') skillCounts['Nói'] = parseInt(r.count, 10);
    });

    const rawLevels = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.hskLevel', 'level')
      .addSelect('COUNT(q.id)', 'count')
      .groupBy('q.hskLevel')
      .orderBy('q.hskLevel', 'ASC')
      .getRawMany();

    const levelCounts: Record<string, number> = {
      'HSK 1': 0,
      'HSK 2': 0,
      'HSK 3': 0,
      'HSK 4': 0,
      'HSK 5': 0,
      'HSK 6': 0,
    };

    rawLevels.forEach((r) => {
      const lvl = parseInt(r.level, 10);
      if (lvl >= 1 && lvl <= 6) {
        levelCounts[`HSK ${lvl}`] = parseInt(r.count, 10);
      }
    });

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
