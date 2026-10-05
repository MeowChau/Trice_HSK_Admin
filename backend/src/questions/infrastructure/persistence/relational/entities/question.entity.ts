import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ExamSectionQuestionEntity } from '../../../../../exams/infrastructure/persistence/relational/entities/exam-section-question.entity';
import { PracticeSetQuestionEntity } from '../../../../../practice-sets/infrastructure/persistence/relational/entities/practice-set-question.entity';
import { QuestionTypeEnum, QuestionSkillEnum } from './question.enum';

@Entity({
  name: 'question',
})
export class QuestionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: QuestionTypeEnum,
  })
  type: QuestionTypeEnum;

  @Column({
    type: 'enum',
    enum: QuestionSkillEnum,
    enumName: 'question_skill_enum',
  })
  skill: QuestionSkillEnum;

  @Column({ type: Number })
  difficulty: number;

  @Column({ type: Number })
  hskLevel: number;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  correctAnswer: Record<string, any> | null;

  @Column({ type: 'boolean', default: false })
  isGameQuestion: boolean;

  @OneToMany(() => ExamSectionQuestionEntity, (seq) => seq.question)
  examSectionQuestions: ExamSectionQuestionEntity[];

  @OneToMany(() => PracticeSetQuestionEntity, (psq) => psq.question)
  practiceSetQuestions: PracticeSetQuestionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
