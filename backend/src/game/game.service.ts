import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import Redis from 'ioredis';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import {
  GamificationService,
  ExpAwardResult,
} from '../gamification/gamification.service';
import { GameSessionEntity } from './infrastructure/persistence/relational/entities/game-session.entity';

export const PK_TURN_MS = 10000;
export const PK_REVEAL_MS = 1500;
export const PK_READY_MS = 60000;
const EVENT_CHANNEL = 'hsk:pk:committed-events:v1';

export interface PkQuestion {
  id: number;
  hanzi: string;
  pinyin: string;
  prompt: string;
  options: { id: string; text: string }[];
}
interface PrivateQuestion extends PkQuestion {
  correctOptionId: string;
}
interface PkPlayer {
  id: number;
  name: string;
  photoUrl: string | null;
  hskLevel: number;
}
interface PkScore {
  userId: number;
  score: number;
  correctCount: number;
  combo: number;
  totalQuestions: number;
}
export interface PkRoomState {
  revision: number;
  roomId: string;
  users: number[];
  players: PkPlayer[];
  readyUserIds: number[];
  index: number;
  stage: 'waiting' | 'playing' | 'reveal' | 'finished';
  turnUserId: number;
  deadline: number;
  scores: PkScore[];
  serverNow: number;
}
export interface PkMatch extends PkRoomState {
  questions: PkQuestion[];
}
export interface PkAnswer extends PkRoomState {
  userId: number;
  questionId: number;
  optionId: string | null;
  correct: boolean;
  correctOptionId: string;
}
export interface PkResult extends PkRoomState {
  winnerId: number | null;
  reason: 'completed' | 'forfeit';
  durationInSeconds: number;
  rewards: ({ userId: number } & ExpAwardResult)[];
}
export interface PersistedPkState {
  revision?: number;
  questions: PrivateQuestion[];
  players: PkPlayer[];
  readyUserIds: number[];
  scores: PkScore[];
  answeredUserIds: number[];
  index: number;
  startedAt: number | null;
  turnStartedAt: number | null;
  lastAnswer: PkAnswer | null;
  result: PkResult | null;
}
export interface PkEvent {
  userIds: number[];
  event:
    | 'match_found'
    | 'player_ready_update'
    | 'game_started'
    | 'turn_changed'
    | 'answer_result'
    | 'game_finished'
    | 'match_cancelled';
  payload:
    | PkRoomState
    | PkMatch
    | PkAnswer
    | PkResult
    | { roomId: string; message: string };
}
export type MatchResult =
  | { matchFound: false }
  | { matchFound: true; match: PkMatch; events: PkEvent[] };

/** Convert only playable, unambiguous options. Raw question entities stay server-side. */
export function normalizePkQuestion(
  question: QuestionEntity,
): PrivateQuestion | null {
  const payload = question.payload;
  const source = payload?.options;
  if (
    payload?.imageUrl ||
    payload?.image ||
    payload?.audioUrl ||
    payload?.audio ||
    payload?.optionImages
  )
    return null;
  if (!Array.isArray(source) || source.length < 2 || source.length > 4)
    return null;
  const options = source.map((option: unknown, index: number) => {
    if (typeof option === 'string')
      return { id: String.fromCharCode(65 + index), text: option.trim() };
    const row = option as Record<string, unknown> | null;
    const id = row?.id ?? row?.key ?? String.fromCharCode(65 + index);
    const label = row?.text ?? row?.label ?? row?.value;
    return {
      id: String(id),
      text: typeof label === 'string' ? label.trim() : '',
    };
  });
  if (
    options.some((o) => !o.id || !o.text) ||
    new Set(options.map((o) => o.id)).size !== options.length ||
    new Set(options.map((o) => o.text)).size !== options.length
  )
    return null;
  const answer = question.correctAnswer;
  const explicitIndex = answer?.correctIndex ?? answer?.index;
  const value =
    answer?.correctOptionId ??
    answer?.optionId ??
    answer?.answer ??
    answer?.value;
  let correct =
    options.find((o) => o.id === String(value)) ??
    options.find((o) => o.text === value);
  if (!correct && typeof value === 'string' && /^[A-D]$/i.test(value))
    correct = options[value.toUpperCase().charCodeAt(0) - 65];
  if (!correct && Number.isInteger(explicitIndex))
    correct = options[Number(explicitIndex)];
  if (!correct && typeof value === 'number' && Number.isInteger(value))
    correct = options[value];
  if (!correct) return null;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    id: question.id,
    hanzi: text(
      payload.hanzi ?? payload.word ?? payload.character ?? payload.sentence,
    ),
    pinyin: text(payload.pinyin),
    prompt:
      text(
        payload.prompt ??
          payload.question ??
          payload.text ??
          payload.instruction,
      ) || 'Chọn đáp án đúng',
    options,
    correctOptionId: correct.id,
  };
}

@Injectable()
export class GameService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameService.name);
  private redis: Redis;
  private subscriber: Redis;
  private readonly listeners = new Set<(event: PkEvent) => void>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    @InjectRepository(GameSessionEntity)
    private readonly sessionRepository: Repository<GameSessionEntity>,
    private readonly gamification: GamificationService,
  ) {}

  async getHistory(
    userId: number,
    params: { page?: number; limit?: number } = {},
  ) {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException();
    }
    const page = Math.max(1, Math.trunc(params.page || 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit || 10)));
    const offset = (page - 1) * limit;
    const [sessions, total] = await this.sessionRepository
      .createQueryBuilder('game')
      .where(':userId = ANY(game.userIds)', { userId })
      .andWhere('game.status = :status', { status: 'finished' })
      .andWhere("game.state->'result' IS NOT NULL")
      .andWhere("game.state->'result' <> 'null'::jsonb")
      .orderBy('game.completedAt', 'DESC')
      .addOrderBy('game.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    // The persisted state also contains private answers; return only summaries.
    const data = sessions.map((session, index) => {
      const result = session.state.result!;
      const score = result.scores.find((item) => item.userId === userId);
      if (!score) throw new Error('PK history is missing the player’s score.');
      return {
        id: session.id,
        matchIndex: total - offset - index,
        hskLevel: session.hskLevel,
        opponentName:
          result.players.find((player) => player.id !== userId)?.name ||
          'Đối thủ',
        score: score.score,
        correctCount: score.correctCount,
        totalQuestions: score.totalQuestions,
        isWin: result.winnerId === userId,
        isDraw: result.winnerId === null,
        xpEarned:
          result.rewards?.find((reward) => reward.userId === userId)
            ?.expAwarded ?? 0,
        reason: result.reason,
        completedAt: session.completedAt?.toISOString() ?? null,
      };
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async onModuleInit() {
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
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('error', (error: Error) =>
      this.logger.error('Game event subscription failed', error.message),
    );
    this.subscriber.on('message', (channel, message) => {
      if (channel !== EVENT_CHANNEL) return;
      try {
        const event = JSON.parse(message) as PkEvent;
        this.listeners.forEach((listener) => listener(event));
      } catch {
        this.logger.error('Invalid committed game event');
      }
    });
    await this.subscriber.subscribe(EVENT_CHANNEL);
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
    this.redis?.disconnect();
  }

  subscribeEvents(listener: (event: PkEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called only after the transaction returns: no uncommitted result is broadcast. */
  async dispatch(events: PkEvent[]): Promise<void> {
    for (const event of events) {
      await this.redis.publish(EVENT_CHANNEL, JSON.stringify(event));
    }
  }

  async handleUserConnect(
    userId: number,
    hskLevel: number,
    socketId: string,
  ): Promise<number> {
    const count = await this.redis.eval(
      `
      redis.call('SADD', KEYS[1], ARGV[1])
      redis.call('EXPIRE', KEYS[1], 45)
      redis.call('SADD', KEYS[2], ARGV[2])
      redis.call('ZADD', KEYS[3], ARGV[3], ARGV[1])
      redis.call('EXPIRE', KEYS[3], 45)
      return redis.call('SCARD', KEYS[2])
    `,
      3,
      this.socketKey(hskLevel, userId),
      `online_users_hsk_${hskLevel}`,
      this.userSocketKey(userId),
      socketId,
      String(userId),
      Date.now(),
    );
    return Number(count);
  }

  async refreshPresence(
    users: { userId: number; hskLevel: number; socketId: string }[],
  ): Promise<void> {
    if (!users.length) return;
    const pipeline = this.redis.pipeline();
    for (const user of users) {
      pipeline.sadd(this.socketKey(user.hskLevel, user.userId), user.socketId);
      pipeline.expire(this.socketKey(user.hskLevel, user.userId), 45);
      pipeline.expire(this.intentKey(user.hskLevel, user.userId), 45);
      pipeline.zadd(this.userSocketKey(user.userId), Date.now(), user.socketId);
      pipeline.expire(this.userSocketKey(user.userId), 45);
    }
    await pipeline.exec();
  }

  async handleUserDisconnect(
    userId: number,
    hskLevel: number,
    socketId: string,
  ): Promise<{ count: number; lastSocket: boolean; events: PkEvent[] }> {
    const result = (await this.redis.eval(
      `
      redis.call('SREM', KEYS[1], ARGV[1])
      redis.call('ZREM', KEYS[5], ARGV[1])
      redis.call('ZREMRANGEBYSCORE', KEYS[5], '-inf', ARGV[3])
      local last = 0
      if redis.call('ZCARD', KEYS[5]) == 0 then redis.call('DEL', KEYS[5]); last = 1 end
      if redis.call('SCARD', KEYS[1]) == 0 then
        redis.call('DEL', KEYS[1])
        redis.call('SREM', KEYS[2], ARGV[2])
        redis.call('LREM', KEYS[3], 0, ARGV[2])
        redis.call('SREM', KEYS[4], ARGV[2])
      end
      return { redis.call('SCARD', KEYS[2]), last }
    `,
      5,
      this.socketKey(hskLevel, userId),
      `online_users_hsk_${hskLevel}`,
      `matchmaking_queue_hsk_${hskLevel}`,
      `matchmaking_members_hsk_${hskLevel}`,
      this.userSocketKey(userId),
      socketId,
      String(userId),
      Date.now() - 45000,
    )) as number[];
    return {
      count: Number(result[0]),
      lastSocket: result[1] === 1,
      events:
        result[1] === 1 ? await this.leaveMatch(userId, hskLevel, true) : [],
    };
  }

  async findMatch(
    userId: number,
    hskLevel: number,
    resumeRoomId?: string,
  ): Promise<MatchResult> {
    // Snapshot before any database await. A later cancellation invalidates this
    // request even if its DB reads finish after the account leaves the queue.
    const generation =
      (await this.redis.get(this.generationKey(userId))) ?? '0';
    const requested = resumeRoomId
      ? await this.sessionRepository.findOneBy({ id: resumeRoomId })
      : null;
    if (requested) this.assertMember(requested, userId);
    const existing =
      (await this.activeSession(userId)) ??
      (requested?.status !== 'cancelled' ? requested : null);
    if (existing) {
      this.assertMember(existing, userId);
      if (
        ((await this.redis.get(this.generationKey(userId))) ?? '0') !==
        generation
      )
        return { matchFound: false };
      return {
        matchFound: true,
        match: this.publicMatch(existing),
        events: this.resumeEvents(existing, userId),
      };
    }
    const pair = (await this.redis.eval(
      `
      if (redis.call('GET', KEYS[4]) or '0') ~= ARGV[4] then return {} end
      redis.call('SET', KEYS[3], 'waiting', 'EX', 45)
      if redis.call('SADD', KEYS[2], ARGV[1]) == 1 then redis.call('RPUSH', KEYS[1], ARGV[1]) end
      local pair = {}
      while redis.call('LLEN', KEYS[1]) > 0 and #pair < 2 do
        local user = redis.call('LPOP', KEYS[1])
        redis.call('SREM', KEYS[2], user)
        if redis.call('EXISTS', ARGV[2] .. user) == 1 and redis.call('GET', ARGV[3] .. user) == 'waiting' then table.insert(pair, user) end
      end
      if #pair == 1 then redis.call('SADD', KEYS[2], pair[1]); redis.call('LPUSH', KEYS[1], pair[1]); return {} end
      return pair
    `,
      4,
      `matchmaking_queue_hsk_${hskLevel}`,
      `matchmaking_members_hsk_${hskLevel}`,
      this.intentKey(hskLevel, userId),
      this.generationKey(userId),
      String(userId),
      `game_sockets_hsk_${hskLevel}_`,
      `matchmaking_intent_hsk_${hskLevel}_`,
      generation,
    )) as string[];
    if (pair.length < 2) return { matchFound: false };
    const userIds = [...new Set(pair.map(Number))];
    if (userIds.length !== 2)
      throw new BadRequestException('Invalid matchmaking pair');
    try {
      const session = await this.sessionRepository.manager.transaction(
        async (manager) => {
          // Prevent the same account entering two rooms, including requests from two devices.
          for (const id of [...userIds].sort((a, b) => a - b))
            await manager.query('SELECT pg_advisory_xact_lock(17491, $1)', [
              id,
            ]);
          for (const id of userIds) {
            if (
              !(await this.redis.exists(this.socketKey(hskLevel, id))) ||
              (await this.redis.get(this.intentKey(hskLevel, id))) !== 'waiting'
            )
              return null;
          }
          const busy = await manager
            .getRepository(GameSessionEntity)
            .createQueryBuilder('game')
            .where('game."userIds" && :userIds::integer[]', { userIds })
            .andWhere('game.status IN (:...statuses)', {
              statuses: ['waiting', 'playing', 'reveal'],
            })
            .getOne();
          if (busy) return null;
          const questions = await this.loadQuestions(hskLevel);
          const users = await manager.getRepository(UserEntity).find({
            where: userIds.map((id) => ({ id })),
            relations: { photo: true },
          });
          if (users.length !== 2)
            throw new BadRequestException('Player not found');
          const now = Date.now();
          const created = await manager.getRepository(GameSessionEntity).save(
            manager.getRepository(GameSessionEntity).create({
              userIds,
              hskLevel,
              status: 'waiting',
              deadline: new Date(now + PK_READY_MS),
              completedAt: null,
              state: {
                revision: 0,
                questions,
                players: userIds.map((id) => {
                  const user = users.find((u) => u.id === id)!;
                  return {
                    id,
                    name: user.fullName || user.username || 'Người chơi',
                    photoUrl: user.photo?.path || null,
                    hskLevel,
                  };
                }),
                readyUserIds: [],
                scores: userIds.map((id) => ({
                  userId: id,
                  score: 0,
                  correctCount: 0,
                  combo: 0,
                  totalQuestions: questions.length / 2,
                })),
                answeredUserIds: [],
                index: 0,
                startedAt: null,
                turnStartedAt: null,
                lastAnswer: null,
                result: null,
              },
            }),
          );
          await this.redis.del(
            ...userIds.map((id) => this.intentKey(hskLevel, id)),
          );
          return created;
        },
      );
      if (!session) {
        await this.restoreQueue(userIds, hskLevel);
        return { matchFound: false };
      }
      return {
        matchFound: true,
        match: this.publicMatch(session),
        events: [this.event(session, 'match_found', this.publicMatch(session))],
      };
    } catch (error) {
      await this.restoreQueue(userIds, hskLevel);
      throw error;
    }
  }

  async ready(userId: number, roomId: string): Promise<PkEvent[]> {
    return this.locked(roomId, async (session, manager) => {
      this.assertMember(session, userId);
      if (session.state.result) return this.resumeEvents(session, userId);
      if (session.status === 'cancelled')
        throw new BadRequestException('Trận đấu đã bị hủy.');
      if (session.status !== 'waiting')
        return this.resumeEvents(session, userId);
      if (session.deadline!.getTime() <= Date.now())
        return this.cancel(session, manager);
      if (!session.state.readyUserIds.includes(userId))
        session.state.readyUserIds.push(userId);
      const started = session.state.readyUserIds.length === 2;
      session.state.revision = (session.state.revision ?? 0) + 1;
      if (started) {
        session.status = 'playing';
        session.state.startedAt = Date.now();
        session.state.turnStartedAt = Date.now();
        session.deadline = new Date(Date.now() + PK_TURN_MS);
      }
      await manager.getRepository(GameSessionEntity).save(session);
      const events = [
        this.event(session, 'player_ready_update', this.publicRoom(session)),
      ];
      if (started)
        events.push(
          this.event(session, 'game_started', this.publicMatch(session)),
        );
      return events;
    });
  }

  async answer(
    userId: number,
    roomId: string,
    questionId: number,
    optionId: string,
  ): Promise<PkEvent[]> {
    return this.locked(roomId, async (session, manager) => {
      this.assertMember(session, userId);
      if (session.state.result) return this.resumeEvents(session, userId);
      const question = session.state.questions[session.state.index];
      if (
        session.status !== 'playing' ||
        session.userIds[session.state.index % 2] !== userId ||
        question?.id !== questionId
      )
        throw new BadRequestException(
          'Chưa đến lượt hoặc câu hỏi đã được trả lời.',
        );
      if (!question.options.some((option) => option.id === optionId))
        throw new BadRequestException('Đáp án không hợp lệ.');
      if (session.deadline!.getTime() <= Date.now())
        return this.reveal(session, manager, null);
      return this.reveal(session, manager, optionId);
    });
  }

  async cancelMatch(userId: number, hskLevel: number): Promise<PkEvent[]> {
    return this.leaveMatch(userId, hskLevel);
  }

  async advanceExpired(): Promise<PkEvent[]> {
    const expired = await this.sessionRepository
      .createQueryBuilder('game')
      .select('game.id')
      .where('game.status IN (:...statuses)', {
        statuses: ['waiting', 'playing', 'reveal'],
      })
      .andWhere('game.deadline <= :now', { now: new Date() })
      .orderBy('game.deadline', 'ASC')
      .limit(100)
      .getMany();
    const events: PkEvent[] = [];
    for (const session of expired) {
      events.push(
        ...(await this.locked(session.id, async (locked, manager) => {
          if (!locked.deadline || locked.deadline.getTime() > Date.now())
            return [];
          if (locked.status === 'waiting') return this.cancel(locked, manager);
          if (locked.status === 'playing')
            return this.reveal(locked, manager, null);
          if (locked.status === 'reveal') {
            locked.state.index++;
            if (locked.state.index >= locked.state.questions.length)
              return this.finish(locked, manager, 'completed');
            locked.status = 'playing';
            locked.state.revision = (locked.state.revision ?? 0) + 1;
            locked.state.turnStartedAt = Date.now();
            locked.deadline = new Date(Date.now() + PK_TURN_MS);
            await manager.getRepository(GameSessionEntity).save(locked);
            return [
              this.event(locked, 'turn_changed', this.publicRoom(locked)),
            ];
          }
          return [];
        })),
      );
    }
    return events;
  }

  private async loadQuestions(hskLevel: number): Promise<PrivateQuestion[]> {
    const rows = await this.questionRepository
      .createQueryBuilder('question')
      .where('question.hskLevel = :hskLevel', { hskLevel })
      .andWhere('question.isGameQuestion = true')
      .orderBy('RANDOM()')
      .limit(200)
      .getMany();
    const valid = rows
      .map(normalizePkQuestion)
      .filter((q): q is PrivateQuestion => q !== null);
    if (valid.length < 10) {
      // Imported vocabulary exercises already have real answers and text options.
      // Use only this compatible text template; never invent questions or expose
      // image/listening exercises that the current PK screen cannot render.
      const fallback = await this.questionRepository
        .createQueryBuilder('question')
        .where('question.hskLevel = :hskLevel', { hskLevel })
        .andWhere("question.payload ->> 'templateId' = :template", {
          template: 'read-text-choice',
        })
        .andWhere("question.payload -> 'source' ->> 'origin' = :origin", {
          origin: 'authored-from-source-vocabulary',
        })
        .orderBy('RANDOM()')
        .limit(200)
        .getMany();
      const seen = new Set(valid.map((q) => q.id));
      for (const row of fallback) {
        const question = normalizePkQuestion(row);
        if (question && !seen.has(question.id)) {
          valid.push(question);
          seen.add(question.id);
        }
      }
    }
    if (valid.length < 10)
      throw new BadRequestException(
        'Chưa đủ 10 câu hỏi PK hợp lệ cho trình độ này.',
      );
    return valid.slice(0, 10);
  }

  private activeSession(
    userId: number,
    hskLevel?: number,
    manager = this.sessionRepository.manager,
  ) {
    const query = manager
      .getRepository(GameSessionEntity)
      .createQueryBuilder('game')
      .where(':userId = ANY(game."userIds")', { userId })
      .andWhere('game.status IN (:...statuses)', {
        statuses: ['waiting', 'playing', 'reveal'],
      });
    if (hskLevel !== undefined)
      query.andWhere('game.hskLevel = :hskLevel', { hskLevel });
    return query.getOne();
  }

  private async leaveMatch(
    userId: number,
    hskLevel: number,
    onlyWhenOffline = false,
  ): Promise<PkEvent[]> {
    return this.sessionRepository.manager.transaction(async (manager) => {
      // Share the exact same user lock with room creation. A cancellation
      // cannot miss an in-flight pair which has been removed from Redis.
      await manager.query('SELECT pg_advisory_xact_lock(17491, $1)', [userId]);
      if (
        onlyWhenOffline &&
        Number(
          await this.redis.eval(
            `redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1]); return redis.call('ZCARD', KEYS[1])`,
            1,
            this.userSocketKey(userId),
            Date.now() - 45000,
          ),
        ) > 0
      )
        return [];
      await this.redis.incr(this.generationKey(userId));
      for (const queueLevel of new Set([
        hskLevel,
        ...Array.from({ length: 9 }, (_, index) => index + 1),
      ]))
        await this.redis.eval(
          `redis.call('LREM', KEYS[1], 0, ARGV[1]); redis.call('SREM', KEYS[2], ARGV[1]); redis.call('DEL', KEYS[3]); return 1`,
          3,
          `matchmaking_queue_hsk_${queueLevel}`,
          `matchmaking_members_hsk_${queueLevel}`,
          this.intentKey(queueLevel, userId),
          String(userId),
        );
      const session = await this.activeSession(userId, undefined, manager);
      if (!session) return [];
      const locked = await manager
        .getRepository(GameSessionEntity)
        .createQueryBuilder('game')
        .where('game.id = :roomId', { roomId: session.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!locked) return [];
      if (locked.state.result || locked.status === 'cancelled') return [];
      if (locked.status === 'waiting') return this.cancel(locked, manager);
      // All ten turns already have server-confirmed outcomes; leaving during
      // the final reveal must not turn a completed game into an unfinished one.
      if (
        locked.status === 'reveal' &&
        locked.state.index === locked.state.questions.length - 1
      )
        return this.finish(locked, manager, 'completed');
      return this.finish(locked, manager, 'forfeit', userId);
    });
  }

  private async locked<T>(
    roomId: string,
    task: (session: GameSessionEntity, manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.sessionRepository.manager.transaction(async (manager) => {
      const session = await manager
        .getRepository(GameSessionEntity)
        .createQueryBuilder('game')
        .where('game.id = :roomId', { roomId })
        .setLock('pessimistic_write')
        .getOne();
      if (!session) throw new NotFoundException('Không tìm thấy trận đấu.');
      return task(session, manager);
    });
  }

  private async reveal(
    session: GameSessionEntity,
    manager: EntityManager,
    optionId: string | null,
  ): Promise<PkEvent[]> {
    const state = session.state;
    const question = state.questions[state.index];
    const userId = session.userIds[state.index % 2];
    const score = state.scores.find((s) => s.userId === userId)!;
    const correct = optionId === question.correctOptionId;
    if (optionId !== null && !state.answeredUserIds.includes(userId))
      state.answeredUserIds.push(userId);
    if (correct) {
      score.combo = Math.min(3, score.combo + 1);
      const remaining = Math.max(
        0,
        Math.min(PK_TURN_MS, session.deadline!.getTime() - Date.now()),
      );
      score.score +=
        (100 + Math.floor((50 * remaining) / PK_TURN_MS)) * score.combo;
      score.correctCount++;
    } else score.combo = 0;
    session.status = 'reveal';
    state.revision = (state.revision ?? 0) + 1;
    session.deadline = new Date(Date.now() + PK_REVEAL_MS);
    state.lastAnswer = {
      ...this.publicRoom(session),
      userId,
      questionId: question.id,
      optionId,
      correct,
      correctOptionId: question.correctOptionId,
    };
    await manager.getRepository(GameSessionEntity).save(session);
    return [this.event(session, 'answer_result', state.lastAnswer)];
  }

  private async finish(
    session: GameSessionEntity,
    manager: EntityManager,
    reason: 'completed' | 'forfeit',
    forfeitingUserId?: number,
  ): Promise<PkEvent[]> {
    if (session.state.result)
      return [this.event(session, 'game_finished', session.state.result)];
    session.status = 'finished';
    session.state.revision = (session.state.revision ?? 0) + 1;
    session.deadline = null;
    session.completedAt = new Date();
    const [first, second] = session.state.scores;
    const winnerId =
      reason === 'forfeit'
        ? session.userIds.find((id) => id !== forfeitingUserId)!
        : first.score === second.score
          ? null
          : first.score > second.score
            ? first.userId
            : second.userId;
    // Always lock in ID order, shared with every EXP source. No per-day match cap.
    const users = await manager
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select(['user.id', 'user.level', 'user.currentExp'])
      .where('user.id IN (:...ids)', {
        ids: [...session.userIds].sort((a, b) => a - b),
      })
      .orderBy('user.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const rewards: PkResult['rewards'] = [];
    for (const user of users) {
      const eligible =
        reason === 'completed' &&
        session.state.answeredUserIds.includes(user.id);
      const amount = eligible
        ? winnerId === null
          ? 15
          : winnerId === user.id
            ? 30
            : 5
        : 0;
      const reward =
        amount > 0
          ? await this.gamification.awardOnce(
              manager,
              user.id,
              'pk',
              session.id,
              amount,
              { reason, winnerId, ruleVersion: 1 },
            )
          : {
              expAwarded: 0,
              level: user.level,
              currentExp: user.currentExp,
              totalExp: this.gamification.totalExperience(user),
            };
      rewards.push({ userId: user.id, ...reward });
    }
    session.state.result = {
      ...this.publicRoom(session),
      winnerId,
      reason,
      durationInSeconds: Math.max(
        0,
        Math.floor(
          (Date.now() - (session.state.startedAt ?? Date.now())) / 1000,
        ),
      ),
      rewards,
    };
    await manager.getRepository(GameSessionEntity).save(session);
    return [this.event(session, 'game_finished', session.state.result)];
  }

  private async cancel(
    session: GameSessionEntity,
    manager: EntityManager,
  ): Promise<PkEvent[]> {
    session.status = 'cancelled';
    session.state.revision = (session.state.revision ?? 0) + 1;
    session.deadline = null;
    session.completedAt = new Date();
    await manager.getRepository(GameSessionEntity).save(session);
    return [
      this.event(session, 'match_cancelled', {
        roomId: session.id,
        message:
          'Trận đấu đã hủy vì người chơi chưa sẵn sàng hoặc đã rời trận.',
      }),
    ];
  }

  private assertMember(session: GameSessionEntity, userId: number): void {
    if (!session.userIds.includes(userId))
      throw new ForbiddenException('Bạn không thuộc trận đấu này.');
  }

  private publicRoom(session: GameSessionEntity): PkRoomState {
    return {
      revision: session.state.revision ?? 0,
      roomId: session.id,
      users: session.userIds,
      players: session.state.players,
      readyUserIds: session.state.readyUserIds,
      index: Math.min(session.state.index, session.state.questions.length - 1),
      stage: session.status === 'cancelled' ? 'finished' : session.status,
      turnUserId: session.userIds[session.state.index % 2],
      deadline: session.deadline?.getTime() ?? 0,
      scores: session.state.scores,
      serverNow: Date.now(),
    };
  }

  private publicMatch(session: GameSessionEntity): PkMatch {
    return {
      ...this.publicRoom(session),
      questions: session.state.questions.map((question) => ({
        id: question.id,
        hanzi: question.hanzi,
        pinyin: question.pinyin,
        prompt: question.prompt,
        options: question.options,
      })),
    };
  }

  private resumeEvents(session: GameSessionEntity, userId: number): PkEvent[] {
    const events = [
      this.event(session, 'match_found', this.publicMatch(session)),
    ];
    if (session.state.result)
      events.push(
        this.event(session, 'game_finished', {
          ...session.state.result,
          serverNow: Date.now(),
        }),
      );
    else if (session.status === 'playing' || session.status === 'reveal') {
      events.push(
        this.event(session, 'game_started', this.publicMatch(session)),
      );
      if (session.status === 'reveal' && session.state.lastAnswer)
        events.push(
          this.event(session, 'answer_result', {
            ...session.state.lastAnswer,
            serverNow: Date.now(),
          }),
        );
    }
    // Replays belong only to the account that requested recovery. The former
    // opponent may already be in a different game.
    return events.map((event) => ({ ...event, userIds: [userId] }));
  }

  private event(
    session: GameSessionEntity,
    event: PkEvent['event'],
    payload: PkEvent['payload'],
  ): PkEvent {
    return { userIds: session.userIds, event, payload };
  }
  private socketKey(hskLevel: number, userId: number): string {
    return `game_sockets_hsk_${hskLevel}_${userId}`;
  }
  private intentKey(hskLevel: number, userId: number): string {
    return `matchmaking_intent_hsk_${hskLevel}_${userId}`;
  }
  private userSocketKey(userId: number): string {
    return `game_live_sockets_user_${userId}`;
  }
  private generationKey(userId: number): string {
    return `matchmaking_generation_user_${userId}`;
  }

  private async restoreQueue(
    userIds: number[],
    hskLevel: number,
  ): Promise<void> {
    for (const userId of userIds) {
      if (await this.activeSession(userId)) continue;
      await this.redis.eval(
        `if redis.call('EXISTS', KEYS[3]) == 1 and redis.call('GET', KEYS[4]) == 'waiting' and redis.call('SADD', KEYS[2], ARGV[1]) == 1 then redis.call('RPUSH', KEYS[1], ARGV[1]) end; return 1`,
        4,
        `matchmaking_queue_hsk_${hskLevel}`,
        `matchmaking_members_hsk_${hskLevel}`,
        this.socketKey(hskLevel, userId),
        this.intentKey(hskLevel, userId),
        String(userId),
      );
    }
  }
}
