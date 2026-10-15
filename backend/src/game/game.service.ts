import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

type MatchResult =
  | { matchFound: false }
  | {
      matchFound: true;
      roomId: string;
      users: number[];
      questions: QuestionEntity[];
    };

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
  ) {}

  onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL', { infer: true });
    this.redis = url
      ? new Redis(url)
      : new Redis({
          host:
            this.configService.get<string>('REDIS_HOST', { infer: true }) ||
            'localhost',
          port: Number(
            this.configService.get<string>('REDIS_PORT', { infer: true }) ||
              6379,
          ),
          password: this.configService.get<string>('REDIS_PASSWORD', {
            infer: true,
          }),
        });
    this.redis.on('error', (error: Error) =>
      this.logger.error('Game Redis connection failed', error.message),
    );
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  async handleUserConnect(
    userId: number,
    hskLevel: number,
    socketId: string,
  ): Promise<number> {
    const result = await this.redis.eval(
      `
      redis.call('SADD', KEYS[1], ARGV[1])
      redis.call('SADD', KEYS[2], ARGV[2])
      return redis.call('SCARD', KEYS[2])
    `,
      2,
      `game_sockets_hsk_${hskLevel}_${userId}`,
      `online_users_hsk_${hskLevel}`,
      socketId,
      String(userId),
    );
    return Number(result);
  }

  async handleUserDisconnect(
    userId: number,
    hskLevel: number,
    socketId: string,
  ): Promise<number> {
    const result = await this.redis.eval(
      `
      redis.call('SREM', KEYS[1], ARGV[1])
      if redis.call('SCARD', KEYS[1]) == 0 then
        redis.call('DEL', KEYS[1])
        redis.call('SREM', KEYS[2], ARGV[2])
        redis.call('LREM', KEYS[3], 0, ARGV[2])
        redis.call('SREM', KEYS[4], ARGV[2])
      end
      return redis.call('SCARD', KEYS[2])
    `,
      4,
      `game_sockets_hsk_${hskLevel}_${userId}`,
      `online_users_hsk_${hskLevel}`,
      `matchmaking_queue_hsk_${hskLevel}`,
      `matchmaking_members_hsk_${hskLevel}`,
      socketId,
      String(userId),
    );
    return Number(result);
  }

  async findMatch(userId: number, hskLevel: number): Promise<MatchResult> {
    const queueKey = `matchmaking_queue_hsk_${hskLevel}`;
    const membersKey = `matchmaking_members_hsk_${hskLevel}`;
    // Enqueue once and remove a pair atomically; concurrent requests cannot pair a user with themselves.
    const users = (await this.redis.eval(
      `
      if redis.call('SADD', KEYS[2], ARGV[1]) == 1 then
        redis.call('RPUSH', KEYS[1], ARGV[1])
      end
      if redis.call('LLEN', KEYS[1]) < 2 then return {} end
      local first = redis.call('LPOP', KEYS[1])
      local second = redis.call('LPOP', KEYS[1])
      redis.call('SREM', KEYS[2], first, second)
      return { first, second }
    `,
      2,
      queueKey,
      membersKey,
      String(userId),
    )) as string[];

    if (users.length < 2) return { matchFound: false };

    try {
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
        roomId: `room_hsk_${hskLevel}_${randomUUID()}`,
        users: users.map(Number),
        questions,
      };
    } catch (error) {
      // Restore waiting users if loading questions fails, without duplicating concurrent enqueues.
      await this.redis.eval(
        `
        for _, user in ipairs(ARGV) do
          if redis.call('SISMEMBER', KEYS[3], user) == 1 and redis.call('SADD', KEYS[2], user) == 1 then
            redis.call('RPUSH', KEYS[1], user)
          end
        end
      `,
        3,
        queueKey,
        membersKey,
        `online_users_hsk_${hskLevel}`,
        ...users,
      );
      throw error;
    }
  }
}
