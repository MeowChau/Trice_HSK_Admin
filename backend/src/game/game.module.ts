import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { QuestionsModule } from '../questions/questions.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [QuestionsModule, ConfigModule, AuthModule, JwtModule.register({})],
  providers: [GameGateway, GameService],
})
export class GameModule {}
