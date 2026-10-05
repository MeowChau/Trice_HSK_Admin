import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

@Entity({
  name: 'audit_log',
})
export class AuditLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: Number, nullable: true })
  userId: number | null;

  @Column({ type: String, nullable: true })
  userName: string | null;

  @Column({ type: String, nullable: true })
  userEmail: string | null;

  @Column({ type: String, nullable: true })
  userRole: string | null;

  @Index()
  @Column({ type: String })
  action: string; // 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET_PASSWORD' | 'STATUS_CHANGE'

  @Index()
  @Column({ type: String })
  entityType: string; // 'QUESTION' | 'EXAM' | 'PRACTICE_SET' | 'TEACHER' | 'STUDENT' | 'AUTH'

  @Column({ type: String })
  entityId: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', nullable: true })
  oldData: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  newData: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  changedFields: string[] | null;

  @Column({ type: String, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
