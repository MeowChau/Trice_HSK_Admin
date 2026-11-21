import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { randomInt } from 'crypto';
import type { PaymentLink } from '@payos/node';
import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import { ExamPaymentEntity } from './infrastructure/persistence/relational/entities/exam-payment.entity';
import { ExamPurchaseEntity } from './infrastructure/persistence/relational/entities/exam-purchase.entity';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { examAccess, type ExamViewer } from './exam-access';
import { PayosService, validCheckoutUrl } from './payos.service';

@Injectable()
export class ExamPaymentsService {
  constructor(
    private readonly db: DataSource,
    private readonly payos: PayosService,
  ) {}

  private view(order: ExamPaymentEntity) {
    return {
      id: order.id,
      examId: order.examId,
      examTitle: order.examTitle,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      checkoutUrl: ['creating', 'pending'].includes(order.status)
        ? order.checkoutUrl
        : null,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      accessGranted: order.status === 'paid' && order.examId !== null,
    };
  }

  async checkout(examId: number, viewer: ExamViewer) {
    const exam = await this.db
      .getRepository(ExamEntity)
      .findOneBy({ id: examId });
    if (!exam) throw new NotFoundException('Không tìm thấy đề thi.');
    const access = (await examAccess(this.db.manager, [exam], viewer)).get(
      exam.id,
    )!;
    if (access.canAttempt) return { accessGranted: true };
    if (!this.payos.configured())
      throw new BadRequestException(
        'Thanh toán đang được cấu hình. Vui lòng thử lại sau.',
      );
    const origin = this.payos.returnOrigin();
    let order = await this.db.transaction(async (manager) => {
      // Serialize checkout per account so double clicks and other tabs reuse one open invoice.
      await manager.getRepository(UserEntity).findOneOrFail({
        where: { id: Number(viewer.id) },
        loadEagerRelations: false,
        lock: { mode: 'pessimistic_write' },
      });
      const existing = await manager.getRepository(ExamPaymentEntity).findOne({
        where: {
          userId: Number(viewer.id),
          examId,
          status: In(['creating', 'pending']),
        },
        order: { createdAt: 'DESC' },
      });
      if (existing) return existing;
      const granted = await manager
        .getRepository(ExamPurchaseEntity)
        .existsBy({ userId: Number(viewer.id), examId });
      if (granted) return null;
      return manager.getRepository(ExamPaymentEntity).save(
        manager.getRepository(ExamPaymentEntity).create({
          userId: Number(viewer.id),
          examId,
          examTitle: exam.title,
          hskLevel: exam.hskLevel,
          orderCode: Date.now() * 1000 + randomInt(1000),
          amount: access.price,
          currency: 'VND',
          status: 'creating',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        }),
      );
    });
    if (!order) return { accessGranted: true };
    if (order.checkoutUrl)
      return this.status(order.id, Number(viewer.id), true);
    if (order.expiresAt.getTime() <= Date.now()) {
      const existing = await this.payos.get(order.orderCode);
      if (existing) return this.view(await this.reconcile(order, existing));
      await this.db
        .getRepository(ExamPaymentEntity)
        .update({ id: order.id, status: 'creating' }, { status: 'expired' });
      return this.view({ ...order, status: 'expired' });
    }
    const callback = origin + '/exams/' + examId + '?payment=' + order.id;
    const created = await this.payos.create({
      orderCode: order.orderCode,
      amount: order.amount,
      description: 'HSK' + order.orderCode.toString(36).slice(-6).toUpperCase(),
      items: [
        { name: exam.title.slice(0, 200), quantity: 1, price: order.amount },
      ],
      returnUrl: callback,
      cancelUrl: callback,
      expiredAt: Math.floor(order.expiresAt.getTime() / 1000),
    });
    if (
      created.amount !== order.amount ||
      created.orderCode !== order.orderCode ||
      created.currency !== 'VND'
    )
      throw new BadRequestException(
        'Thông tin thanh toán không khớp đơn hàng.',
      );
    order = await this.db.transaction(async (manager) => {
      const current = await manager
        .getRepository(ExamPaymentEntity)
        .findOneOrFail({
          where: { id: order!.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (
        current.paymentLinkId &&
        current.paymentLinkId !== created.paymentLinkId
      )
        throw new BadRequestException('Mã thanh toán không khớp.');
      if (!['creating', 'pending'].includes(current.status)) return current;
      current.paymentLinkId = created.paymentLinkId;
      current.checkoutUrl = validCheckoutUrl(created.checkoutUrl);
      current.status = 'pending';
      return manager.getRepository(ExamPaymentEntity).save(current);
    });
    // A reused order may already be paid. Only the authenticated provider lookup can grant access.
    return created.status === 'PAID'
      ? this.status(order.id, Number(viewer.id), true)
      : this.view(order);
  }

  async status(id: string, userId: number, force = false) {
    const order = await this.db
      .getRepository(ExamPaymentEntity)
      .findOneBy({ id, userId });
    if (!order)
      throw new NotFoundException('Không tìm thấy giao dịch của bạn.');
    if (order.status === 'paid') return this.view(order);
    if (
      !force &&
      order.checkedAt &&
      order.checkedAt.getTime() > Date.now() - 5000
    )
      return this.view(order);
    const claim = await this.db
      .getRepository(ExamPaymentEntity)
      .createQueryBuilder()
      .update()
      .set({ checkedAt: new Date() })
      .where('id = :id', { id })
      .andWhere(
        force ? 'true' : '("checkedAt" IS NULL OR "checkedAt" < :cutoff)',
        { cutoff: new Date(Date.now() - 5000) },
      )
      .execute();
    if (!claim.affected)
      return this.view(
        await this.db
          .getRepository(ExamPaymentEntity)
          .findOneByOrFail({ id, userId }),
      );
    const info = await this.payos.get(order.orderCode);
    if (!info) return this.view(order);
    return this.view(await this.reconcile(order, info));
  }

  private async reconcile(order: ExamPaymentEntity, info: PaymentLink) {
    if (
      info.orderCode !== order.orderCode ||
      info.amount !== order.amount ||
      (order.paymentLinkId && info.id !== order.paymentLinkId)
    )
      throw new BadRequestException('Thông tin giao dịch không khớp đơn hàng.');
    const checkoutUrl = this.payos.checkoutFor(info.id);
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(ExamPaymentEntity);
      const current = await repository.findOneOrFail({
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (current.status === 'paid') return current;
      if (current.paymentLinkId && current.paymentLinkId !== info.id)
        throw new BadRequestException('Mã giao dịch không khớp.');
      current.paymentLinkId = info.id;
      current.checkoutUrl = checkoutUrl;
      current.checkedAt = new Date();
      if (info.status === 'PAID') {
        if (info.amountPaid < current.amount || info.amountRemaining !== 0)
          throw new BadRequestException(
            'Giao dịch chưa thanh toán đủ số tiền.',
          );
        current.status = 'paid';
        current.paidAt = new Date();
        if (current.examId !== null)
          await manager
            .getRepository(ExamPurchaseEntity)
            .createQueryBuilder()
            .insert()
            .values({
              userId: current.userId,
              examId: current.examId,
              paymentId: current.id,
            })
            .orIgnore()
            .execute();
      } else if (info.status === 'CANCELLED') current.status = 'cancelled';
      else if (info.status === 'EXPIRED' || info.status === 'FAILED')
        current.status = 'expired';
      else current.status = 'pending';
      return repository.save(current);
    });
  }

  async webhook(body: unknown) {
    const verified = await this.payos.verify(body);
    if (verified.code !== '00' || verified.currency !== 'VND')
      return { received: true };
    const order = await this.db
      .getRepository(ExamPaymentEntity)
      .findOneBy({ orderCode: verified.orderCode });
    // payOS also sends a signed test event while registering the webhook.
    if (!order) return { received: true };
    if (order.paymentLinkId && order.paymentLinkId !== verified.paymentLinkId)
      throw new BadRequestException('Mã thông báo không khớp đơn hàng.');
    if (order.status !== 'paid') {
      const info = await this.payos.get(order.orderCode);
      if (!info)
        throw new BadRequestException('Chưa tìm thấy giao dịch trên payOS.');
      await this.reconcile(order, info);
    }
    return { received: true };
  }
}
