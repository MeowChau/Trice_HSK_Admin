import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'vocabulary',
})
export class VocabularyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String })
  hanzi: string;

  @Column({ type: String })
  pinyin: string;

  @Column({ type: String })
  meaning: string;

  @Column({ type: Number })
  hskLevel: number;

  @Column({ type: String, nullable: true })
  topic?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
