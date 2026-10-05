import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyEntity } from './infrastructure/persistence/relational/entities/vocabulary.entity';
import { OfflineGameHistoryEntity } from './infrastructure/persistence/relational/entities/offline-game-history.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

@Injectable()
export class OfflineGamesService {
  constructor(
    @InjectRepository(VocabularyEntity)
    private readonly vocabularyRepository: Repository<VocabularyEntity>,
    @InjectRepository(OfflineGameHistoryEntity)
    private readonly offlineGameHistoryRepository: Repository<OfflineGameHistoryEntity>,
  ) {}

  async getRandomWords(
    hskLevel: number,
    limit: number,
  ): Promise<VocabularyEntity[]> {
    return this.vocabularyRepository
      .createQueryBuilder('vocabulary')
      .where('vocabulary.hskLevel = :hskLevel', { hskLevel })
      .orderBy('RANDOM()')
      .limit(limit)
      .getMany();
  }

  async saveScore(
    userId: number,
    score: number,
  ): Promise<OfflineGameHistoryEntity> {
    const history = this.offlineGameHistoryRepository.create({
      score,
      playedAt: new Date(),
      user: { id: userId } as UserEntity,
    });
    return this.offlineGameHistoryRepository.save(history);
  }

  async getTopScores(userId: number): Promise<OfflineGameHistoryEntity[]> {
    return this.offlineGameHistoryRepository
      .createQueryBuilder('history')
      .where('history.user.id = :userId', { userId })
      .orderBy('history.score', 'DESC')
      .limit(5)
      .getMany();
  }
}
