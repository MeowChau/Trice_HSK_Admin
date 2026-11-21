import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsController } from './exams.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamSectionEntity } from './infrastructure/persistence/relational/entities/exam-section.entity';
import { ExamSectionQuestionEntity } from './infrastructure/persistence/relational/entities/exam-section-question.entity';
import { ExamPaymentEntity } from './infrastructure/persistence/relational/entities/exam-payment.entity';
import { ExamPurchaseEntity } from './infrastructure/persistence/relational/entities/exam-purchase.entity';
import { PayosService } from './payos.service';
import { ExamPaymentsService } from './exam-payments.service';
import { ExamPaymentsController } from './exam-payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamEntity,
      ExamSectionEntity,
      ExamSectionQuestionEntity,
      ExamPaymentEntity,
      ExamPurchaseEntity,
    ]),
  ],
  controllers: [ExamsController, ExamPaymentsController],
  providers: [ExamsService, PayosService, ExamPaymentsService],
})
export class ExamsModule {}
