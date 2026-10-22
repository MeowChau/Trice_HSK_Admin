import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { ExpAwardEntity } from './infrastructure/persistence/relational/entities/exp-award.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ExpAwardEntity])],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
