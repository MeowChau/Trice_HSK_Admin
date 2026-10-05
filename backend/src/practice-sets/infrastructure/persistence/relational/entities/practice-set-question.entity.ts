import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PracticeSetEntity } from './practice-set.entity';
import { QuestionEntity } from '../../../../../questions/infrastructure/persistence/relational/entities/question.entity';

@Entity({
  name: 'practice_set_question',
})
export class PracticeSetQuestionEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  practiceSetId: number;

  @PrimaryColumn()
  questionId: number;

  @Column({ type: Number })
  order: number;

  @ManyToOne(
    () => PracticeSetEntity,
    (practiceSet) => practiceSet.practiceSetQuestions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'practiceSetId' })
  practiceSet: PracticeSetEntity;

  @ManyToOne(
    () => QuestionEntity,
    (question) => question.practiceSetQuestions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'questionId' })
  question: QuestionEntity;
}
