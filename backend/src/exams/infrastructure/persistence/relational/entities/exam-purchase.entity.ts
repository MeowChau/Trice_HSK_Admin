import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'exam_purchase' })
export class ExamPurchaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'integer' }) userId: number;
  @Column({ type: 'integer' }) examId: number;
  @Column({ type: 'uuid' }) paymentId: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
