import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      host:
        this.configService.get<string>('REDIS_HOST', { infer: true }) ||
        'localhost',
      port:
        this.configService.get<number>('REDIS_PORT', { infer: true }) || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD', {
        infer: true,
      }),
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async handleUserConnect(userId: number, hskLevel: number) {
    const setKey = `online_users_hsk_${hskLevel}`;
    await this.redis.sadd(setKey, userId.toString());
    const count = await this.redis.scard(setKey);
    return count;
  }

  async handleUserDisconnect(userId: number, hskLevel: number) {
    const setKey = `online_users_hsk_${hskLevel}`;
    await this.redis.srem(setKey, userId.toString());
    const count = await this.redis.scard(setKey);
    return count;
  }

  async findMatch(userId: number, hskLevel: number) {
    const queueKey = `matchmaking_queue_hsk_${hskLevel}`;
    // Add user to the queue
    await this.redis.rpush(queueKey, userId.toString());

    // Check if we have at least 2 users
    const queueLen = await this.redis.llen(queueKey);
    if (queueLen >= 2) {
      // Pop 2 users
      const user1 = await this.redis.lpop(queueKey);
      const user2 = await this.redis.lpop(queueKey);

      if (user1 && user2) {
        // Create Room
        const roomId = `room_hsk_${hskLevel}_${randomUUID()}`;

        // Fetch 10 random game questions for this HSK level
        const questions = await this.questionRepository
          .createQueryBuilder('question')
          .where('question.hskLevel = :hskLevel', { hskLevel })
          .andWhere('question.isGameQuestion = :isGameQuestion', {
            isGameQuestion: true,
          })
          .orderBy('RANDOM()')
          .limit(10)
          .getMany();

        return {
          matchFound: true,
          roomId,
          users: [parseInt(user1, 10), parseInt(user2, 10)],
          questions,
        };
      } else {
        // In case one of them popped but was null due to race condition, push back the valid one
        if (user1) await this.redis.rpush(queueKey, user1);
        if (user2) await this.redis.rpush(queueKey, user2);
      }
    }
    return { matchFound: false };
  }
}
