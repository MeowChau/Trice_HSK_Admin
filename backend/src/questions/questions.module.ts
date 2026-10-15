import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionEntity } from './infrastructure/persistence/relational/entities/question.entity';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionEntity]), AuditLogsModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService, TypeOrmModule],
})
export class QuestionsModule {}
