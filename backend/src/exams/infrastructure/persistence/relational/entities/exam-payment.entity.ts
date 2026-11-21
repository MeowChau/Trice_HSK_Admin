import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamPaymentStatus =
  | 'creating'
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'expired';

@Entity({ name: 'exam_payment' })
export class ExamPaymentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'integer' }) userId: number;
  @Column({ type: 'integer', nullable: true }) examId: number | null;
  @Column({ type: 'text' }) examTitle: string;
  @Column({ type: 'integer' }) hskLevel: number;
  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  orderCode: number;
  @Column({ type: 'integer' }) amount: number;
  @Column({ type: 'varchar', length: 3, default: 'VND' }) currency: string;
  @Column({ type: 'varchar', length: 12, default: 'creating' })
  status: ExamPaymentStatus;
  @Column({ type: 'varchar', length: 100, nullable: true }) paymentLinkId:
    | string
    | null;
  @Column({ type: 'text', nullable: true }) checkoutUrl: string | null;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) checkedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
