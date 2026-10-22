import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

export type ExpAwardSource = 'daily_checkin' | 'pk';

@Entity({ name: 'exp_award' })
@Unique('UQ_exp_award_user_source', ['userId', 'source', 'sourceId'])
@Check('CHK_exp_award_amount', '"amount" >= 0')
export class ExpAwardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_exp_award_user' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 32 })
  source: ExpAwardSource;

  @Column({ type: 'varchar', length: 128 })
  sourceId: string;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
