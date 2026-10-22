import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PersistedPkState } from '../../../../game.service';

@Entity({ name: 'game_session' })
@Index('IDX_game_session_status_deadline', ['status', 'deadline'])
export class GameSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', array: true })
  userIds: number[];

  @Column({ type: 'integer' })
  hskLevel: number;

  // Includes private answer snapshots. Never serialize this entity to clients.
  @Column({ type: 'jsonb' })
  state: PersistedPkState;

  @Column({ type: 'varchar', length: 20, default: 'waiting' })
  status: 'waiting' | 'playing' | 'reveal' | 'finished' | 'cancelled';

  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
