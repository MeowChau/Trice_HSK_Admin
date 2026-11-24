import { Repository } from 'typeorm';
import { LeaderboardService } from './leaderboard.service';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';

describe('Streak ranking and current-streak summary', () => {
  function service(
    stats: Array<{
      userId: number;
      longestStreak: number;
      currentStreak: number;
      totalDays: number;
      totalSeconds: number;
    }>,
  ) {
    const query = {
      leftJoinAndSelect: () => query,
      where: () => query,
      andWhere: () => query,
      getMany: () =>
        Promise.resolve(
          stats.map((row) => ({
            id: row.userId,
            fullName: `User ${row.userId}`,
          })),
        ),
    };
    const users = {
      query: () => Promise.resolve(stats),
      createQueryBuilder: () => query,
    } as unknown as Repository<UserEntity>;
    return new LeaderboardService(
      users,
      {} as Repository<StudySessionLogEntity>,
    );
  }

  it('should rank an ended record above a shorter ongoing streak but keep the ongoing KPI separate', async () => {
    const result = await service([
      {
        userId: 1,
        longestStreak: 10,
        currentStreak: 0,
        totalDays: 10,
        totalSeconds: 1000,
      },
      {
        userId: 2,
        longestStreak: 2,
        currentStreak: 2,
        totalDays: 2,
        totalSeconds: 2000,
      },
    ]).getStreakLeaderboard();
    expect(result.leaderboard.map((row) => row.id)).toEqual([1, 2]);
    expect(result.summary).toMatchObject({
      allTimeRecord: 10,
      topStreak: 2,
      topStreakUser: 'User 2',
    });
  });

  it('should compare exact seconds before rounded display hours and resolve equal scores by ID', async () => {
    const result = await service(
      [3, 1, 2].map((id) => ({
        userId: id,
        longestStreak: 4,
        currentStreak: 0,
        totalDays: 5,
        totalSeconds: id === 1 ? 1000 : 1001,
      })),
    ).getStreakLeaderboard();
    expect(result.leaderboard.map((row) => row.id)).toEqual([2, 3, 1]);
    expect(new Set(result.leaderboard.map((row) => row.totalHours)).size).toBe(
      1,
    );
    expect(result.summary.topStreakUser).toBeNull();
  });
});
