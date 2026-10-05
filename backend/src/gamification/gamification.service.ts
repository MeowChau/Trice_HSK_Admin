import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

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
    const user = await this.userRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!user) {
      return null;
    }

    user.currentExp = (user.currentExp || 0) + expToAdd;

    // Formula: Threshold = current level * 1000
    // Keep leveling up while currentExp >= threshold
    let threshold = (user.level || 1) * 1000;

    while (user.currentExp >= threshold) {
      user.currentExp -= threshold;
      user.level = (user.level || 1) + 1;
      threshold = user.level * 1000;
      this.logger.log(`User ${user.id} leveled up to Level ${user.level}!`);
    }

    return this.userRepository.save(user);
  }
}
