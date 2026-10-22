import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import {
  ExpAwardEntity,
  ExpAwardSource,
} from './infrastructure/persistence/relational/entities/exp-award.entity';
import { totalExperience } from './experience';

export { totalExperience } from './experience';

export interface ExpAwardResult {
  expAwarded: number;
  level: number;
  currentExp: number;
  totalExp: number;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Cron Job to reset daily tasks.
   * Runs every day at midnight (00:00).
   */
  @Cron('0 0 * * *') // Run at midnight every day
  handleDailyReset() {
    this.logger.debug(
      'Bắt đầu quy trình reset Daily Tasks cho toàn hệ thống...',
    );
    // Logic to reset daily tasks (e.g. updating a 'daily_tasks' table) goes here
    // await this.dailyTaskRepository.update({}, { isCompleted: false });
    this.logger.debug('Hoàn tất reset Daily Tasks.');
  }

  /**
   * Add EXP to a user and handle level up.
   */
  async addExp(
    userId: string | number,
    expToAdd: number,
  ): Promise<UserEntity | null> {
    this.validateAmount(expToAdd);
    return this.userRepository.manager.transaction(async (manager) => {
      const user = await this.lockUser(manager, Number(userId));
      if (!user) return null;
      await this.applyExp(manager, user, expToAdd);
      return user;
    });
  }

  totalExperience(user: { level: number; currentExp: number }): number {
    return totalExperience(user);
  }

  async awardOnce(
    manager: EntityManager,
    userId: number,
    source: ExpAwardSource,
    sourceId: string,
    amount: number,
    metadata?: Record<string, unknown>,
  ): Promise<ExpAwardResult> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('EXP awards require an active transaction.');
    }
    this.validateAmount(amount);
    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !['daily_checkin', 'pk'].includes(source) ||
      typeof sourceId !== 'string' ||
      !sourceId.trim() ||
      sourceId.length > 128
    ) {
      throw new BadRequestException('Invalid EXP award source.');
    }
    const user = await this.lockUser(manager, userId);
    if (!user) throw new NotFoundException('User not found');

    const inserted = await manager
      .getRepository(ExpAwardEntity)
      .createQueryBuilder()
      .insert()
      .values({
        userId,
        source,
        sourceId,
        amount,
        metadata: () => ':awardMetadata',
      })
      .setParameter('awardMetadata', { ...metadata, ruleVersion: 1 })
      .orIgnore()
      .returning('id')
      .execute();
    const expAwarded =
      Array.isArray(inserted.raw) && inserted.raw.length > 0 ? amount : 0;
    if (expAwarded > 0) await this.applyExp(manager, user, expAwarded);

    return {
      expAwarded,
      level: user.level,
      currentExp: user.currentExp,
      totalExp: totalExperience(user),
    };
  }

  private validateAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2147483647) {
      throw new BadRequestException('Invalid EXP amount.');
    }
  }

  private lockUser(manager: EntityManager, userId: number) {
    return manager
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .select(['user.id', 'user.level', 'user.currentExp'])
      .where('user.id = :userId', { userId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async applyExp(
    manager: EntityManager,
    user: UserEntity,
    amount: number,
  ): Promise<void> {
    user.currentExp += amount;
    while (user.currentExp >= user.level * 1000) {
      user.currentExp -= user.level * 1000;
      user.level += 1;
    }
    await manager.getRepository(UserEntity).update(user.id, {
      level: user.level,
      currentExp: user.currentExp,
    });
  }
}
