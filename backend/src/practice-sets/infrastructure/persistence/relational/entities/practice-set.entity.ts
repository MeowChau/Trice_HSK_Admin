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
import { PracticeSetQuestionEntity } from './practice-set-question.entity';
import { QuestionSkillEnum } from '../../../../../questions/infrastructure/persistence/relational/entities/question.enum';

@Entity({
  name: 'practice_set',
})
export class PracticeSetEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String })
  title: string;

  @Column({ type: String })
  topic: string;

  @Column({
    type: 'enum',
    enum: QuestionSkillEnum,
    enumName: 'question_skill_enum',
  })
  skill: QuestionSkillEnum;

  @Column({ type: Number })
  hskLevel: number;

  @Column({ type: String, nullable: true })
  audioUrl: string | null;

  @OneToMany(() => PracticeSetQuestionEntity, (psq) => psq.practiceSet)
  practiceSetQuestions: PracticeSetQuestionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
