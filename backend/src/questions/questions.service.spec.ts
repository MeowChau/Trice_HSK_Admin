import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QuestionsService } from './questions.service';
import { QuestionEntity } from './infrastructure/persistence/relational/entities/question.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

describe('QuestionsService audit snapshots', () => {
  it('should preserve the original question snapshot when repository merge mutates the entity', async () => {
    const oldQuestion = {
      id: 1,
      type: 'MULTIPLE_CHOICE',
      skill: 'READING',
      hskLevel: 1,
      payload: { text: 'old' },
      correctAnswer: { answer: 'A' },
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(oldQuestion),
      merge: jest.fn((entity: object, update: object) =>
        Object.assign(entity, update),
      ),
      save: jest.fn((entity: object) => Promise.resolve(entity)),
    };
    const audit = { record: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: getRepositoryToken(QuestionEntity), useValue: repo },
        { provide: AuditLogsService, useValue: audit },
      ],
    }).compile();
    await module
      .get(QuestionsService)
      .update(1, { payload: { text: 'new' }, correctAnswer: { answer: 'B' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        oldData: expect.objectContaining({
          payload: { text: 'old' },
          correctAnswer: { answer: 'A' },
        }),
        newData: expect.objectContaining({
          payload: { text: 'new' },
          correctAnswer: { answer: 'B' },
        }),
      }),
    );
  });
});
