import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [GamificationService],
})
export class GamificationModule {}
