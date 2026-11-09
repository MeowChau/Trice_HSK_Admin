import { Global, Module } from '@nestjs/common';
import { LearningScoresService } from './learning-scores.service';
import { LearningScoresController } from './learning-scores.controller';
@Global()
@Module({
  providers: [LearningScoresService],
  controllers: [LearningScoresController],
  exports: [LearningScoresService],
})
export class LearningScoresModule {}
