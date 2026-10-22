import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { QuestionsModule } from '../questions/questions.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameSessionEntity } from './infrastructure/persistence/relational/entities/game-session.entity';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    QuestionsModule,
    ConfigModule,
    AuthModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([GameSessionEntity]),
    GamificationModule,
  ],
  providers: [GameGateway, GameService],
})
export class GameModule {}
