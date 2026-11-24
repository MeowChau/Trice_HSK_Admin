import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DataSource } from 'typeorm';
import { User } from '../../src/users/domain/user';
import { UserEntity } from '../../src/users/infrastructure/persistence/relational/entities/user.entity';
import { UsersRelationalRepository } from '../../src/users/infrastructure/persistence/relational/repositories/user.repository';
import { RoleEntity } from '../../src/roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../../src/statuses/infrastructure/persistence/relational/entities/status.entity';
import { PracticeSetsService } from '../../src/practice-sets/practice-sets.service';
import { PracticeSetEntity } from '../../src/practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import { PracticeSetQuestionEntity } from '../../src/practice-sets/infrastructure/persistence/relational/entities/practice-set-question.entity';
import { VocabularyEntity } from '../../src/offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';
import { QuestionEntity } from '../../src/questions/infrastructure/persistence/relational/entities/question.entity';
import {
  QuestionSkillEnum,
  QuestionTypeEnum,
} from '../../src/questions/infrastructure/persistence/relational/entities/question.enum';
import { AuditLogEntity } from '../../src/audit-logs/infrastructure/persistence/relational/entities/audit-log.entity';
import { BadRequestException } from '@nestjs/common';
import { ExamEntity } from '../../src/exams/infrastructure/persistence/relational/entities/exam.entity';
import { ExamPaymentEntity } from '../../src/exams/infrastructure/persistence/relational/entities/exam-payment.entity';
import { ExamPurchaseEntity } from '../../src/exams/infrastructure/persistence/relational/entities/exam-purchase.entity';
import { ExamPaymentsService } from '../../src/exams/exam-payments.service';
import { assertExamAccess, examAccess } from '../../src/exams/exam-access';
import { PayosService } from '../../src/exams/payos.service';
import type { CreatePaymentLinkRequest } from '@payos/node';

describe('PostgreSQL migrations, transactions and concurrent writes', () => {
  const databaseName = `backend_review_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let database: DataSource;
  let createdDatabase = false;
  let users: UsersRelationalRepository;
  let practice: PracticeSetsService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url)
      throw new Error(
        'TEST_DATABASE_URL is required; use a test PostgreSQL account with CREATEDB permission.',
      );
    admin = new DataSource({ type: 'postgres', url, logging: false });
    await admin.initialize();
    await admin.query(
      `CREATE DATABASE "${databaseName}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    createdDatabase = true;
    const isolatedUrl = new URL(url);
    isolatedUrl.pathname = `/${databaseName}`;
    database = new DataSource({
      type: 'postgres',
      url: isolatedUrl.toString(),
      logging: false,
      synchronize: false,
      dropSchema: false,
      entities: [path.join(__dirname, '../../src/**/*.entity.ts')],
      migrations: [path.join(__dirname, '../../src/database/migrations/*.ts')],
      extra: { max: 10 },
    });
    await database.initialize();
    await database.runMigrations({ transaction: 'all' });
    await database.getRepository(RoleEntity).save([
      { id: 1, name: 'Admin' },
      { id: 2, name: 'User' },
    ]);
    await database.getRepository(StatusEntity).save([
      { id: 1, name: 'Active' },
      { id: 2, name: 'Inactive' },
      { id: 3, name: 'Pending' },
    ]);
    users = new UsersRelationalRepository(database.getRepository(UserEntity));
    practice = new PracticeSetsService(
      database.getRepository(PracticeSetEntity),
      database.getRepository(PracticeSetQuestionEntity),
      database.getRepository(VocabularyEntity),
    );
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    try {
      if (
        createdDatabase &&
        admin?.isInitialized &&
        /^backend_review_[a-f\d]{32}$/.test(databaseName)
      ) {
        // Only the unique database created by this suite is removed.
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      }
    } finally {
      if (admin?.isInitialized) await admin.destroy();
    }
  });

  function user(status = 1): User {
    const username = randomUUID();
    return Object.assign(new User(), {
      username,
      email: `${username}@example.com`,
      role: { id: 2 },
      status: { id: status },
    });
  }

  async function setWithQuestions() {
    const set = await practice.create({
      title: 'Test set',
      topic: 'Test',
      skill: QuestionSkillEnum.READING,
      hskLevel: 1,
    });
    const questions = await database.getRepository(QuestionEntity).save(
      [1, 2].map((index) => ({
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        skill: QuestionSkillEnum.READING,
        difficulty: 1,
        hskLevel: 1,
        payload: { text: `Question ${index}` },
        isGameQuestion: false,
      })),
    );
    return { set, questions };
  }

  it('should create every entity table and column from migrations without synchronize', async () => {
    const runner = database.createQueryRunner();
    try {
      for (const metadata of database.entityMetadatas) {
        const table = await runner.getTable(metadata.tableName);
        expect(table).toBeDefined();
        for (const column of metadata.columns) {
          expect(table?.columns.map((entry) => entry.name)).toContain(
            column.databaseName,
          );
        }
      }
    } finally {
      await runner.release();
    }
  });

  it('should allocate unique codes under simultaneous account creation', async () => {
    const saved = await Promise.all(
      Array.from({ length: 10 }, () => users.create(user())),
    );
    expect(new Set(saved.map((entry) => entry.studentCode)).size).toBe(10);
    expect(saved.every((entry) => Number(entry.studentCode) > 0)).toBe(true);
  });

  it('should approve accounts concurrently while preserving partial profile fields', async () => {
    const saved = await Promise.all([
      users.create(user(3)),
      users.create(user(3)),
    ]);
    const approved = await Promise.all(
      saved.map((entry) =>
        users.update(entry.id, { status: { id: 1 }, currentHskLevel: 2 }),
      ),
    );
    expect(approved[0].studentCode).not.toBe(approved[1].studentCode);
    expect(
      approved.every(
        (entry) => entry.email && entry.username && entry.currentHskLevel === 2,
      ),
    ).toBe(true);
  });

  it('should reject duplicate codes even for direct database writes', async () => {
    const existing = await users.create(user());
    await expect(
      database
        .getRepository(UserEntity)
        .save({ username: randomUUID(), studentCode: existing.studentCode }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
  });

  it('should reserve codes held by deleted accounts', async () => {
    const deleted = await users.create(user());
    await users.remove(deleted.id);
    const saved = await users.create(user());
    expect(Number(saved.studentCode)).toBeGreaterThan(
      Number(deleted.studentCode),
    );
  });

  it('should roll back old question deletion if replacement violates a foreign key', async () => {
    const { set, questions } = await setWithQuestions();
    await practice.setQuestions(set.id, [
      { questionId: questions[0].id, order: 0 },
    ]);
    await expect(
      practice.setQuestions(set.id, [{ questionId: 2147483647, order: 0 }]),
    ).rejects.toMatchObject({ driverError: { code: '23503' } });
    const links = await database
      .getRepository(PracticeSetQuestionEntity)
      .findBy({ practiceSetId: set.id });
    expect(links.map((entry) => entry.questionId)).toEqual([questions[0].id]);
  });

  it('should serialize concurrent question replacement without mixing lists', async () => {
    const { set, questions } = await setWithQuestions();
    await Promise.all(
      questions.map((question) =>
        practice.setQuestions(set.id, [{ questionId: question.id, order: 0 }]),
      ),
    );
    const links = await database
      .getRepository(PracticeSetQuestionEntity)
      .findBy({ practiceSetId: set.id });
    expect(links).toHaveLength(1);
    expect(questions.map((entry) => entry.id)).toContain(links[0].questionId);
  });

  it('should cascade linked row deletion while keeping the source question', async () => {
    const { set, questions } = await setWithQuestions();
    await practice.setQuestions(set.id, [
      { questionId: questions[0].id, order: 0 },
    ]);
    await practice.remove(set.id);
    expect(
      await database
        .getRepository(PracticeSetQuestionEntity)
        .countBy({ practiceSetId: set.id }),
    ).toBe(0);
    expect(
      await database
        .getRepository(QuestionEntity)
        .findOneBy({ id: questions[0].id }),
    ).not.toBeNull();
  });

  it('should persist audit snapshots and vocabulary topics on a migrated database', async () => {
    const entry = await database.getRepository(AuditLogEntity).save({
      action: 'UPDATE',
      entityType: 'QUESTION',
      entityId: '7',
      summary: 'Test audit',
      oldData: { text: 'old' },
      newData: { text: 'new' },
    });
    expect(entry.oldData).toEqual({ text: 'old' });
    const vocabulary = await database.getRepository(VocabularyEntity).save({
      hanzi: '你',
      pinyin: 'nǐ',
      meaning: 'Bạn',
      hskLevel: 1,
      topic: 'Test',
    });
    expect(vocabulary.topic).toBe('Test');
  });

  describe('Exam purchases without external payment requests', () => {
    let nextOrderCode = 1000000000;

    async function fixture() {
      const viewer = await users.create(user());
      const repository = database.getRepository(ExamEntity);
      const free = await repository.save({ title: 'Sample', hskLevel: 9 });
      const paid = await repository.save({ title: 'Paid', hskLevel: 9 });
      const paymentLinkId = randomUUID().replace(/-/g, '');
      const provider = {
        configured: () => true,
        returnOrigin: () => 'https://student.example.test',
        checkoutFor: () => `https://pay.payos.vn/web/${paymentLinkId}`,
        create: jest.fn((input: CreatePaymentLinkRequest) => ({
          ...input,
          paymentLinkId,
          checkoutUrl: `https://pay.payos.vn/web/${paymentLinkId}`,
          currency: 'VND',
          status: 'PENDING',
        })),
        get: jest.fn(),
        verify: jest.fn(),
      };
      const payments = new ExamPaymentsService(
        database,
        provider as unknown as PayosService,
      );
      return { viewer, free, paid, paymentLinkId, provider, payments };
    }

    async function pending(f: Awaited<ReturnType<typeof fixture>>) {
      return database.getRepository(ExamPaymentEntity).save({
        userId: Number(f.viewer.id),
        examId: f.paid.id,
        examTitle: f.paid.title,
        hskLevel: f.paid.hskLevel,
        orderCode: nextOrderCode++,
        amount: 2000,
        currency: 'VND',
        status: 'pending',
        paymentLinkId: f.paymentLinkId,
        expiresAt: new Date(Date.now() + 1800000),
      });
    }

    function paidInfo(order: ExamPaymentEntity) {
      return {
        id: order.paymentLinkId,
        orderCode: order.orderCode,
        amount: order.amount,
        amountPaid: order.amount,
        amountRemaining: 0,
        status: 'PAID',
      };
    }

    it('should keep the oldest sample free and reject unpurchased exam attempts', async () => {
      const f = await fixture();
      const access = await examAccess(
        database.manager,
        [f.free, f.paid],
        f.viewer,
      );
      expect(access.get(f.free.id)?.canAttempt).toBe(true);
      expect(access.get(f.paid.id)?.canAttempt).toBe(false);
      await expect(
        assertExamAccess(database.manager, f.paid.id, Number(f.viewer.id)),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('should not disclose or query another user payment', async () => {
      const f = await fixture();
      const order = await pending(f);
      const other = await users.create(user());
      await expect(
        f.payments.status(order.id, Number(other.id)),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.provider.get).not.toHaveBeenCalled();
    });

    it('should reject invalid webhook signatures without granting access', async () => {
      const f = await fixture();
      await pending(f);
      f.provider.verify.mockRejectedValue(new BadRequestException());
      await expect(f.payments.webhook({})).rejects.toMatchObject({
        status: 400,
      });
      expect(f.provider.get).not.toHaveBeenCalled();
      expect(
        await database
          .getRepository(ExamPurchaseEntity)
          .countBy({ userId: Number(f.viewer.id), examId: f.paid.id }),
      ).toBe(0);
    });

    it('should not grant access when the provider amount differs from the order', async () => {
      const f = await fixture();
      const order = await pending(f);
      f.provider.verify.mockResolvedValue({
        code: '00',
        currency: 'VND',
        orderCode: order.orderCode,
        paymentLinkId: f.paymentLinkId,
      });
      f.provider.get.mockResolvedValue({
        ...paidInfo(order),
        amount: order.amount + 1,
      });
      await expect(f.payments.webhook({})).rejects.toMatchObject({
        status: 400,
      });
      expect(
        await database
          .getRepository(ExamPurchaseEntity)
          .countBy({ userId: Number(f.viewer.id), examId: f.paid.id }),
      ).toBe(0);
    });

    it('should grant exactly one purchase when status polling and duplicate webhooks race', async () => {
      const f = await fixture();
      const order = await pending(f);
      f.provider.verify.mockResolvedValue({
        code: '00',
        currency: 'VND',
        orderCode: order.orderCode,
        paymentLinkId: f.paymentLinkId,
      });
      f.provider.get.mockResolvedValue(paidInfo(order));
      await Promise.all([
        f.payments.webhook({}),
        f.payments.webhook({}),
        f.payments.status(order.id, Number(f.viewer.id)),
      ]);
      expect(
        await database
          .getRepository(ExamPurchaseEntity)
          .countBy({ userId: Number(f.viewer.id), examId: f.paid.id }),
      ).toBe(1);
      expect(
        await database.getRepository(ExamPaymentEntity).findOneByOrFail({
          id: order.id,
        }),
      ).toMatchObject({ status: 'paid', paidAt: expect.any(Date) });
      await expect(
        assertExamAccess(database.manager, f.paid.id, Number(f.viewer.id)),
      ).resolves.toBeUndefined();
    });

    it('should reuse the same persisted order code across concurrent checkout requests', async () => {
      const f = await fixture();
      f.provider.get.mockImplementation((orderCode: number) => ({
        id: f.paymentLinkId,
        orderCode,
        amount: 2000,
        amountPaid: 0,
        amountRemaining: 2000,
        status: 'PENDING',
      }));
      const results = await Promise.all([
        f.payments.checkout(f.paid.id, f.viewer),
        f.payments.checkout(f.paid.id, f.viewer),
      ]);
      const orders = await database.getRepository(ExamPaymentEntity).findBy({
        userId: Number(f.viewer.id),
        examId: f.paid.id,
      });
      expect(orders).toHaveLength(1);
      for (const result of results) {
        expect(result).toMatchObject({
          id: orders[0].id,
          status: 'pending',
          accessGranted: false,
        });
      }
      expect(f.provider.create).toHaveBeenCalled();
      expect(
        new Set(f.provider.create.mock.calls.map(([input]) => input.orderCode)),
      ).toEqual(new Set([orders[0].orderCode]));
    });
  });
});
