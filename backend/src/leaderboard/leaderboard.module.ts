import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      StudySessionLogEntity,
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
