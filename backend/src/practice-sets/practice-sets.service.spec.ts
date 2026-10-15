import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PracticeSetsService } from './practice-sets.service';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { PracticeSetQuestionEntity } from './infrastructure/persistence/relational/entities/practice-set-question.entity';
import { VocabularyEntity } from '../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

describe('PracticeSetsService question replacement', () => {
  let service: PracticeSetsService;
  const links = {
    create: jest.fn((data: object) => data),
    delete: jest.fn(),
    save: jest.fn(),
  };
  const manager = {
    findOne: jest.fn(),
    getRepository: jest.fn(() => links),
  };
  const transaction = jest.fn();
  const deleteSet = jest.fn();
  const outsideLinks = { delete: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    links.save.mockReset();
    manager.findOne.mockResolvedValue({ id: 1 });
    deleteSet.mockReset().mockResolvedValue({ affected: 1 });
    const module = await Test.createTestingModule({
      providers: [
        PracticeSetsService,
        {
          provide: getRepositoryToken(PracticeSetEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 1 }),
            delete: deleteSet,
            manager: { transaction },
          },
        },
        {
          provide: getRepositoryToken(PracticeSetQuestionEntity),
          useValue: outsideLinks,
        },
        { provide: getRepositoryToken(VocabularyEntity), useValue: {} },
      ],
    }).compile();
    service = module.get(PracticeSetsService);
    transaction.mockImplementation(
      (callback: (value: typeof manager) => Promise<void>) => callback(manager),
    );
  });

  it('should replace links inside one transaction while locking the parent set', async () => {
    await service.setQuestions(1, [{ questionId: 2, order: 0 }]);
    expect(manager.findOne).toHaveBeenCalledWith(PracticeSetEntity, {
      where: { id: 1 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(links.delete).toHaveBeenCalledWith({ practiceSetId: 1 });
    expect(links.save).toHaveBeenCalledWith([
      { practiceSetId: 1, questionId: 2, order: 0 },
    ]);
    expect(outsideLinks.delete).not.toHaveBeenCalled();
    expect(outsideLinks.save).not.toHaveBeenCalled();
  });

  it('should propagate insert failures out of the transaction so the database rolls back deletions', async () => {
    const error = new Error('Foreign key violation');
    links.save.mockRejectedValue(error);
    await expect(
      service.setQuestions(1, [{ questionId: 999, order: 0 }]),
    ).rejects.toBe(error);
    expect(outsideLinks.delete).not.toHaveBeenCalled();
  });

  it('should permit clearing all linked questions inside the transaction', async () => {
    await service.setQuestions(1, []);
    expect(links.delete).toHaveBeenCalledWith({ practiceSetId: 1 });
    expect(links.save).not.toHaveBeenCalled();
  });

  it('should return 404 if the set was deleted before acquiring its lock', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.setQuestions(1, [])).rejects.toMatchObject({
      status: 404,
    });
    expect(links.delete).not.toHaveBeenCalled();
  });

  it('should delete the parent in one statement without deleting child rows first', async () => {
    await service.remove(1);
    expect(deleteSet).toHaveBeenCalledWith(1);
    expect(outsideLinks.delete).not.toHaveBeenCalled();
  });

  it('should leave linked rows untouched if parent deletion fails', async () => {
    const error = new Error('Deletion failed');
    deleteSet.mockRejectedValue(error);
    await expect(service.remove(1)).rejects.toBe(error);
    expect(outsideLinks.delete).not.toHaveBeenCalled();
  });
});
