import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamPurchaseEntity } from './infrastructure/persistence/relational/entities/exam-purchase.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

export interface ExamViewer {
  id: number | string;
  role?: { id: number | string } | null;
  status?: { id: number | string } | null;
}
export interface ExamAccess {
  isFree: boolean;
  isPurchased: boolean;
  canAttempt: boolean;
  price: number;
  currency: 'VND';
}

export function examPrice(): number {
  const price = Number(process.env.EXAM_PRICE_VND || 2000);
  if (!Number.isSafeInteger(price) || price < 1000 || price > 100000000)
    throw new Error('EXAM_PRICE_VND must be an integer from 1000 to 100000000');
  return price;
}

export async function examAccess(
  manager: EntityManager,
  exams: Pick<ExamEntity, 'id' | 'hskLevel'>[],
  viewer?: ExamViewer | null,
): Promise<Map<number, ExamAccess>> {
  if (!exams.length) return new Map();
  // The oldest available exam of each HSK level remains free, independent of pagination or filters.
  const free = await manager
    .getRepository(ExamEntity)
    .createQueryBuilder('exam')
    .select('MIN(exam.id)', 'id')
    .groupBy('exam.hskLevel')
    .getRawMany<{ id: number }>();
  const freeIds = new Set(free.map((row) => Number(row.id)));
  const active = Number(viewer?.status?.id) === 1;
  const editor = active && [1, 3].includes(Number(viewer?.role?.id));
  const purchased =
    viewer && active
      ? await manager.getRepository(ExamPurchaseEntity).find({
          where: {
            userId: Number(viewer.id),
            examId: In(exams.map((exam) => exam.id)),
          },
          select: { examId: true },
        })
      : [];
  const purchasedIds = new Set(purchased.map((row) => row.examId));
  const price = examPrice();
  return new Map(
    exams.map((exam) => [
      exam.id,
      {
        isFree: freeIds.has(exam.id),
        isPurchased: purchasedIds.has(exam.id),
        canAttempt: freeIds.has(exam.id) || purchasedIds.has(exam.id) || editor,
        price: freeIds.has(exam.id) ? 0 : price,
        currency: 'VND',
      },
    ]),
  );
}

export async function assertExamAccess(
  manager: EntityManager,
  examId: number,
  userId: number,
): Promise<void> {
  const [exam, user] = await Promise.all([
    manager
      .getRepository(ExamEntity)
      .findOne({ where: { id: examId }, select: { id: true, hskLevel: true } }),
    manager.getRepository(UserEntity).findOne({
      where: { id: userId },
      relations: { role: true, status: true },
    }),
  ]);
  if (!exam || !user)
    throw new NotFoundException('Không tìm thấy đề thi hoặc tài khoản.');
  const access = (await examAccess(manager, [exam], user)).get(exam.id)!;
  if (!access.canAttempt)
    throw new ForbiddenException({
      code: 'examPurchaseRequired',
      message: 'Bạn cần mua đề thi này trước khi làm bài.',
      examId,
    });
}
