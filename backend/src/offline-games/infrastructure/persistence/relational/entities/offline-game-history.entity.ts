import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({
  name: 'offline_game_history',
})
export class OfflineGameHistoryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: Number })
  score: number;

  @Column({ type: 'timestamp' })
  playedAt: Date;

  @ManyToOne(() => UserEntity, {
    eager: true,
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;
}
