import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ExamEntity } from './exam.entity';
import { ExamSectionQuestionEntity } from './exam-section-question.entity';

@Entity({
  name: 'exam_section',
})
export class ExamSectionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: Number })
  examId: number;

  @Column({ type: String })
  title: string;

  @Column({ type: Number })
  order: number;

  @Column({ type: String, nullable: true })
  audioUrl: string | null;

  @ManyToOne(() => ExamEntity, (exam) => exam.sections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examId' })
  exam: ExamEntity;

  @OneToMany(() => ExamSectionQuestionEntity, (seq) => seq.section)
  sectionQuestions: ExamSectionQuestionEntity[];
}
