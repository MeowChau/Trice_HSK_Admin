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
import { ExamSectionEntity } from './exam-section.entity';

@Entity({
  name: 'exam',
})
export class ExamEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String })
  title: string;

  @Column({ type: String, nullable: true })
  description: string | null;

  @Column({ type: Number })
  hskLevel: number;

  @OneToMany(() => ExamSectionEntity, (section) => section.exam)
  sections: ExamSectionEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
