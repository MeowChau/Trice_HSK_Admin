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
});
