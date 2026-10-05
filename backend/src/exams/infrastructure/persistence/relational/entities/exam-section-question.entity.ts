import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ExamSectionEntity } from './exam-section.entity';
import { QuestionEntity } from '../../../../../questions/infrastructure/persistence/relational/entities/question.entity';

@Entity({
  name: 'exam_section_question',
})
export class ExamSectionQuestionEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  sectionId: number;

  @PrimaryColumn()
  questionId: number;

  @Column({ type: Number })
  order: number;

  @ManyToOne(() => ExamSectionEntity, (section) => section.sectionQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sectionId' })
  section: ExamSectionEntity;

  @ManyToOne(
    () => QuestionEntity,
    (question) => question.examSectionQuestions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'questionId' })
  question: QuestionEntity;
}
