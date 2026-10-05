import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { PracticeSetQuestionEntity } from './infrastructure/persistence/relational/entities/practice-set-question.entity';
import { PracticeSetsService } from './practice-sets.service';
import { PracticeSetsController } from './practice-sets.controller';
import { AdminPracticeSetsController } from './admin-practice-sets.controller';

import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { VocabularyEntity } from '../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PracticeSetEntity,
      PracticeSetQuestionEntity,
      VocabularyEntity,
    ]),
    AuditLogsModule,
  ],
  controllers: [PracticeSetsController, AdminPracticeSetsController],
  providers: [PracticeSetsService],
  exports: [PracticeSetsService],
})
export class PracticeSetsModule {}
