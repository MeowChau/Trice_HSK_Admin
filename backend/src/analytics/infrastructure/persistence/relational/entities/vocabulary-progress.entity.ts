import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { VocabularyEntity } from '../../../../../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

@Entity({ name: 'vocabulary_progress' })
@Check(
  'CHK_vocabulary_progress_status',
  `"status" IN ('learning', 'remembered', 'needs_review')`,
)
export class VocabularyProgressEntity {
  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_vocabulary_progress',
  })
  userId: number;

  @PrimaryColumn({
    type: 'integer',
    primaryKeyConstraintName: 'PK_vocabulary_progress',
  })
  vocabularyId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_vocabulary_progress_user',
  })
  user: UserEntity;

  @ManyToOne(() => VocabularyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'vocabularyId',
    foreignKeyConstraintName: 'FK_vocabulary_progress_word',
  })
  vocabulary: VocabularyEntity;

  @Column({ type: 'varchar', length: 20, default: 'learning' })
  status: 'learning' | 'remembered' | 'needs_review';

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastStudiedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
