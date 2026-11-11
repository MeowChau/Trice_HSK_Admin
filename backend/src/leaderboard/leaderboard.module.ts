import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';
import { GameLeaderboardController } from './game-leaderboard.controller';
import { GameLeaderboardService } from './game-leaderboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, StudySessionLogEntity])],
  controllers: [LeaderboardController, GameLeaderboardController],
  providers: [LeaderboardService, GameLeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
