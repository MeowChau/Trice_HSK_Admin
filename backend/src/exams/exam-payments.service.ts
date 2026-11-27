import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { randomInt } from 'crypto';
import { studyDate } from '../utils/study-date';
import { ExamRevenueQueryDto } from './dto/exam-revenue.dto';
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

  /** Read the confirmed local ledger; opening analytics never calls payOS or mutates orders. */
  async revenue(query: ExamRevenueQueryDto = {}) {
    const today = studyDate();
    const from = query.from || today.slice(0, 7) + '-01';
    const to = query.to || today;
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(from) || !validDate(to) || from > to)
      throw new BadRequestException(
        'Chọn ngày bắt đầu và kết thúc hợp lệ, ngày bắt đầu không sau ngày kết thúc.',
      );
    const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (days > 366)
      throw new BadRequestException(
        'Mỗi lần xem tối đa 366 ngày. Vui lòng thu hẹp khoảng thời gian.',
      );
    const start = new Date(`${from}T00:00:00+07:00`).toISOString();
    const end = new Date(
      new Date(`${to}T00:00:00+07:00`).getTime() + 86400000,
    ).toISOString();
    const term = query.search?.trim();
    const escapedTerm = term?.replace(
      /[\\%_]/g,
      (character) => '\\' + character,
    );
    const parameters = [
      start,
      end,
      query.hskLevel || null,
      escapedTerm ? '%' + escapedTerm + '%' : null,
    ];
    // Paid orders belong to the date of confirmation; other orders use their creation date.
    // One row per payment prevents purchases or question joins from multiplying revenue.
    const scope = `FROM exam_payment p LEFT JOIN "user" u ON u.id = p."userId"
      WHERE p.currency = 'VND'
        AND (CASE WHEN p.status = 'paid' THEN p."paidAt" ELSE p."createdAt" END) >= $1::timestamptz
        AND (CASE WHEN p.status = 'paid' THEN p."paidAt" ELSE p."createdAt" END) < $2::timestamptz
        AND ($3::int IS NULL OR p."hskLevel" = $3)
        AND ($4::text IS NULL OR p."examTitle" ILIKE $4 OR p."orderCode"::text ILIKE $4
          OR u.email ILIKE $4 OR u.username ILIKE $4 OR u."fullName" ILIKE $4
          OR concat_ws(' ', u."firstName", u."lastName") ILIKE $4)`;
    // A consistent snapshot keeps cards, chart and pagination in agreement during webhook updates.
    return this.db.transaction('REPEATABLE READ', async (manager) => {
      const [totals]: Array<Record<string, string | number>> =
        await manager.query(
          `SELECT
        COUNT(*)::int AS "totalOrders",
        COUNT(*) FILTER (WHERE p.status = 'paid')::int AS "paidOrders",
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0)::text AS "totalRevenue",
        COUNT(DISTINCT p."userId") FILTER (WHERE p.status = 'paid')::int AS "payingCustomers",
        COUNT(*) FILTER (WHERE p.status IN ('creating','pending'))::int AS "pendingOrders",
        COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('creating','pending')), 0)::text AS "pendingAmount",
        COUNT(*) FILTER (WHERE p.status = 'cancelled')::int AS "cancelledOrders",
        COUNT(*) FILTER (WHERE p.status = 'expired')::int AS "expiredOrders" ${scope}`,
          parameters,
        );
      const chartRows: Array<{
        date: string;
        revenue: string;
        paidOrders: number;
      }> = await manager.query(
        `SELECT
        to_char(p."paidAt" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS date,
        SUM(p.amount)::text AS revenue, COUNT(*)::int AS "paidOrders"
        ${scope} AND p.status = 'paid' GROUP BY 1 ORDER BY 1`,
        parameters,
      );
      const topExams: Array<{
        examId: number | null;
        examTitle: string;
        hskLevel: number;
        revenue: string;
        paidOrders: number;
      }> = await manager.query(
        `SELECT
        p."examId", p."examTitle", p."hskLevel", SUM(p.amount)::text AS revenue, COUNT(*)::int AS "paidOrders"
        ${scope} AND p.status = 'paid'
        GROUP BY p."examId", p."examTitle", p."hskLevel"
        ORDER BY SUM(p.amount) DESC, COUNT(*) DESC, p."examTitle" ASC, p."hskLevel" ASC, p."examId" ASC NULLS LAST LIMIT 5`,
        parameters,
      );
      const listScope = `${scope} AND ($5::text IS NULL OR p.status = $5)`;
      const listParameters = [...parameters, query.status || null];
      const [count]: Array<{ total: number }> = await manager.query(
        `SELECT COUNT(*)::int AS total ${listScope}`,
        listParameters,
      );
      const total = Number(count.total);
      const limit = Math.max(1, Math.min(100, Math.trunc(query.limit || 20)));
      const totalPages = Math.ceil(total / limit);
      const page = Math.max(
        1,
        Math.min(Math.trunc(query.page || 1), Math.max(1, totalPages)),
      );
      const transactions: Array<{
        id: string;
        orderCode: string;
        userId: number;
        buyerName: string;
        buyerEmail: string | null;
        examId: number | null;
        examTitle: string;
        hskLevel: number;
        amount: number;
        status: string;
        createdAt: Date;
        paidAt: Date | null;
        expiresAt: Date;
        eventAt: Date;
      }> = await manager.query(
        `SELECT p.id, p."orderCode"::text AS "orderCode", p."userId",
        COALESCE(NULLIF(u."fullName", ''), NULLIF(trim(concat_ws(' ', u."firstName", u."lastName")), ''), u.username, 'Học viên') AS "buyerName",
        u.email AS "buyerEmail", p."examId", p."examTitle", p."hskLevel", p.amount, p.status,
        p."createdAt", p."paidAt", p."expiresAt",
        CASE WHEN p.status = 'paid' THEN p."paidAt" ELSE p."createdAt" END AS "eventAt"
        ${listScope} ORDER BY "eventAt" DESC, p.id DESC LIMIT $6 OFFSET $7`,
        [...listParameters, limit, (page - 1) * limit],
      );
      const summary = Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [key, Number(value)]),
      );
      const byDate = new Map(chartRows.map((row) => [row.date, row]));
      const chart = Array.from({ length: days }, (_, index) => {
        const date = new Date(Date.parse(from) + index * 86400000)
          .toISOString()
          .slice(0, 10);
        const row = byDate.get(date);
        return {
          date,
          revenue: Number(row?.revenue || 0),
          paidOrders: Number(row?.paidOrders || 0),
        };
      });
      return {
        period: { from, to, timeZone: 'Asia/Ho_Chi_Minh' },
        currency: 'VND',
        summary: {
          ...summary,
          averageOrderValue: summary.paidOrders
            ? Math.round(summary.totalRevenue / summary.paidOrders)
            : 0,
        },
        chart,
        topExams: topExams.map((row) => ({
          ...row,
          revenue: Number(row.revenue),
        })),
        transactions,
        total,
        page,
        limit,
        totalPages,
        generatedAt: new Date().toISOString(),
      };
    });
  }

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
