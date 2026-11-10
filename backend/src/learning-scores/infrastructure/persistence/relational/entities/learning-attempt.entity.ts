import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  LearningAttemptSnapshot,
  LearningAttemptSummary,
} from '../../../../history-types';
import type { LearningSkill, SavedScore } from '../../../../score-types';

@Entity({ name: 'learning_attempt_history' })
@Index(
  'UQ_learning_attempt_history_user_client',
  ['userId', 'clientAttemptId'],
  {
    unique: true,
  },
)
@Index('IDX_learning_attempt_history_user_submitted', [
  'userId',
  'submittedAt',
  'id',
])
@Index('IDX_learning_attempt_history_user_source', [
  'userId',
  'kind',
  'sourceId',
  'submittedAt',
])
export class LearningAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 100 })
  clientAttemptId: string;

  @Column({ type: 'varchar', length: 10 })
  kind: 'exam' | 'set';

  @Column({ type: 'integer' })
  sourceId: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'integer' })
  hskLevel: number;

  @Column({ type: 'text', array: true })
  skills: LearningSkill[];

  @Column({ type: 'varchar', length: 12, default: 'draft' })
  status: 'draft' | 'submitted';

  @Column({ type: 'varchar', length: 64, nullable: true })
  requestHash: string | null;

  @Column({ type: 'varchar', length: 64 })
  sourceVersion: string;

  @Column({ type: 'jsonb' })
  snapshot: LearningAttemptSnapshot;

  @Column({ type: 'jsonb', nullable: true })
  result: SavedScore | null;

  @Column({ type: 'jsonb', nullable: true })
  summary: LearningAttemptSummary | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  pendingSpeechRequests: Record<string, string>;

  @Column({ type: 'integer', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
