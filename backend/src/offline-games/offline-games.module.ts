import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfflineGamesController } from './offline-games.controller';
import { OfflineGamesService } from './offline-games.service';
import { VocabularyEntity } from './infrastructure/persistence/relational/entities/vocabulary.entity';
import { OfflineGameHistoryEntity } from './infrastructure/persistence/relational/entities/offline-game-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VocabularyEntity, OfflineGameHistoryEntity]),
  ],
  controllers: [OfflineGamesController],
  providers: [OfflineGamesService],
  exports: [OfflineGamesService],
})
export class OfflineGamesModule {}
