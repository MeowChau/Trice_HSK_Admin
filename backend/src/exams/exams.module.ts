import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamSectionEntity } from './infrastructure/persistence/relational/entities/exam-section.entity';
import { ExamSectionQuestionEntity } from './infrastructure/persistence/relational/entities/exam-section-question.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamEntity,
      ExamSectionEntity,
      ExamSectionQuestionEntity,
    ]),
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
})
export class ExamsModule {}
