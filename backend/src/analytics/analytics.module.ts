import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudySessionLogEntity } from '../study-sessions/infrastructure/persistence/relational/entities/study-session-log.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { PracticeSetEntity } from '../practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudySessionLogEntity,
      UserEntity,
      QuestionEntity,
      ExamEntity,
      PracticeSetEntity,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
