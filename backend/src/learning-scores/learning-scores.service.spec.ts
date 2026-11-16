import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { LearningAttemptEntity } from './infrastructure/persistence/relational/entities/learning-attempt.entity';
import { emptyProgress } from './score-types';
import { DataSource } from 'typeorm';
import { LearningScoresService } from './learning-scores.service';
describe('Learning history ownership', () => {
  it('should scope lookup to the authenticated user even with a valid foreign UUID', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const db = {
      getRepository: jest.fn().mockReturnValue({ findOne }),
    } as unknown as DataSource;
    const service = new LearningScoresService(db);
    const id = '123e4567-e89b-42d3-a456-426614174000';
    await expect(service.historyDetail(7, id)).rejects.toMatchObject({
      status: 404,
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id, userId: 7, status: 'submitted' },
    });
  });
});

describe('Transactional exam submission', () => {
  function setup() {
    const user = {
      id: 7,
      currentHskLevel: 1,
      assessmentProgress: emptyProgress(),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(user),
      update: jest.fn((_id, patch) =>
        Promise.resolve(Object.assign(user, patch)),
      ),
    };
    const saved = new Map<string, LearningAttemptEntity>();
    const attempts = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(saved.get(where.clientAttemptId) || null),
      ),
      create: jest.fn((x) => x),
      save: jest.fn((x) => {
        saved.set(x.clientAttemptId, x);
        return Promise.resolve(x);
      }),
    };
    let id = 0;
    const exam = {
      id: 2,
      title: 'HSK2 fixture',
      hskLevel: 2,
      sections: [35, 25].map((count, index) => ({
        order: index,
        audioUrl: '/fixture.mp3',
        sectionQuestions: Array.from({ length: count }, (_, order) => {
          const questionId = ++id;
          return {
            questionId,
            order,
            question: {
              id: questionId,
              skill: index === 0 ? 'LISTENING' : 'READING',
              type: 'MULTIPLE_CHOICE',
              hskLevel: 2,
              payload: { text: 'Choose', options: ['Hello', 'Thanks'] },
              correctAnswer: { optionId: 'A' },
            },
          };
        }),
      })),
    };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === UserEntity) return userRepo;
        if (entity === LearningAttemptEntity) return attempts;
        if (entity === ExamEntity)
          return { findOne: () => Promise.resolve(exam) };
        throw new Error('Unexpected repository');
      },
    };
    const transaction = jest.fn((fn) => fn(manager));
    const service = new LearningScoresService({
      transaction,
    } as unknown as DataSource);
    const dto = {
      attemptId: '123e4567-e89b-42d3-a456-426614174000',
      kind: 'exam' as const,
      sourceId: 2,
      answers: Object.fromEntries(
        Array.from({ length: 60 }, (_, i) => [String(i + 1), 'A']),
      ),
    };
    return { service, dto, user, userRepo, attempts, transaction };
  }
  it('should save history and promote the profile under a user lock exactly once', async () => {
    const { service, dto, user, userRepo, attempts } = setup();
    const result = await service.submit(7, dto);
    expect(result).toMatchObject({
      passed: true,
      currentHskLevel: 2,
      previousCurrentHskLevel: 1,
      score: 100,
    });
    expect(userRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(user.currentHskLevel).toBe(2);
    expect(await service.submit(7, dto)).toEqual(result);
    expect(attempts.save).toHaveBeenCalledTimes(1);
  });
  it('should reject changed answers under an already submitted attempt ID', async () => {
    const { service, dto, attempts } = setup();
    await service.submit(7, dto);
    await expect(
      service.submit(7, { ...dto, answers: { ...dto.answers, '1': 'B' } }),
    ).rejects.toMatchObject({ status: 409 });
    expect(attempts.save).toHaveBeenCalledTimes(1);
  });
  it('should reject stale source versions and answers outside the loaded source', async () => {
    const { service, dto, attempts } = setup();
    await expect(
      service.submit(7, { ...dto, sourceVersion: 'old-version' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.submit(7, { ...dto, answers: { '999': 'A' } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(attempts.save).not.toHaveBeenCalled();
  });
  it('should never demote a higher profile by passing a lower exam', async () => {
    const { service, dto, user } = setup();
    user.currentHskLevel = 3;
    expect((await service.submit(7, dto)).currentHskLevel).toBe(3);
  });
});
