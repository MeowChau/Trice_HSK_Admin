import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { UsersRelationalRepository } from './user.repository';
import { UserEntity } from '../entities/user.entity';
import { User } from '../../../../domain/user';

describe('UsersRelationalRepository student codes', () => {
  let repository: UsersRelationalRepository;
  const query = {
    withDeleted: jest.fn(),
    select: jest.fn(),
    getRawOne: jest.fn(),
  };
  const transactional = {
    query: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => query),
    create: jest.fn((data: object) => data),
    save: jest.fn(),
  };
  const manager = { getRepository: jest.fn(() => transactional) };
  const transaction = jest.fn();
  const findOne = jest.fn();

  beforeEach(async () => {
    jest.resetAllMocks();
    query.withDeleted.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.getRawOne.mockResolvedValue({ max: '10' });
    transactional.createQueryBuilder.mockReturnValue(query);
    transactional.create.mockImplementation((data: object) => data);
    transactional.save.mockImplementation((data: object) => ({
      ...data,
      id: 7,
    }));
    manager.getRepository.mockReturnValue(transactional);
    transaction.mockImplementation(
      (callback: (value: typeof manager) => Promise<unknown>) =>
        callback(manager),
    );
    const module = await Test.createTestingModule({
      providers: [
        UsersRelationalRepository,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: { manager: { transaction }, findOne },
        },
      ],
    }).compile();
    repository = module.get(UsersRelationalRepository);
  });

  function data(properties: Partial<User> = {}): User {
    return Object.assign(
      new User(),
      {
        email: 'student@example.com',
        username: 'student',
        status: { id: 1 },
        role: { id: 2 },
        studentCode: null,
      },
      properties,
    );
  }

  it('should allocate a student code in the same transaction as the insert and reserve deleted codes', async () => {
    const saved = await repository.create(data());
    expect(saved.studentCode).toBe(11);
    expect(transactional.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [839141],
    );
    expect(query.withDeleted).toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('should defer allocation for pending accounts', async () => {
    const saved = await repository.create(data({ status: { id: 3 } }));
    expect(saved.studentCode).toBeNull();
    expect(transactional.query).not.toHaveBeenCalled();
  });

  it('should reject explicit duplicate codes before saving', async () => {
    transactional.findOne.mockResolvedValue({ id: 8, studentCode: 20 });
    await expect(
      repository.create(data({ studentCode: 20 })),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transactional.save).not.toHaveBeenCalled();
  });

  it('should preserve an explicit available code', async () => {
    transactional.findOne.mockResolvedValue(null);
    const saved = await repository.create(data({ studentCode: 20 }));
    expect(saved.studentCode).toBe(20);
    expect(query.getRawOne).not.toHaveBeenCalled();
  });

  it('should allocate a code when approving a pending account', async () => {
    transactional.findOne.mockResolvedValue({
      id: 7,
      username: 'student',
      email: 'student@example.com',
      role: { id: 2 },
      status: { id: 3 },
      studentCode: null,
    });
    const saved = await repository.update(7, { status: { id: 1 } });
    expect(saved.studentCode).toBe(11);
    expect(transactional.query).toHaveBeenCalled();
  });

  it('should keep existing goals and the student code during a partial update', async () => {
    transactional.findOne.mockResolvedValue({
      id: 7,
      username: 'student',
      email: 'student@example.com',
      role: { id: 2 },
      status: { id: 1 },
      studentCode: 10,
      currentHskLevel: 2,
      targetHskLevel: 5,
      dailyStudyTime: 30,
    });
    const saved = await repository.update(7, {
      fullName: 'Student',
      targetHskLevel: undefined,
    });
    expect(saved).toMatchObject({
      studentCode: 10,
      currentHskLevel: 2,
      targetHskLevel: 5,
      dailyStudyTime: 30,
      fullName: 'Student',
    });
    expect(query.getRawOne).not.toHaveBeenCalled();
    expect(transactional.query).not.toHaveBeenCalled();
  });

  it('should reject automatic student code overflow before saving', async () => {
    query.getRawOne.mockResolvedValue({ max: '2147483647' });
    await expect(repository.create(data())).rejects.toMatchObject({
      status: 409,
    });
    expect(transactional.save).not.toHaveBeenCalled();
  });

  it('should search only real email addresses for password reset and account linking', async () => {
    findOne.mockResolvedValue(null);
    await repository.findByEmail('STUDENT@example.com');
    expect(findOne).toHaveBeenCalledWith({
      where: { email: 'student@example.com' },
    });
  });

  it('should give an exact email match priority over another account username', async () => {
    findOne.mockResolvedValue({ id: 7, email: 'student@example.com' });
    await expect(
      repository.findByLogin('student@example.com'),
    ).resolves.toMatchObject({ id: 7 });
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it('should allow username login when there is no matching email', async () => {
    findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 7, username: 'student' });
    await expect(repository.findByLogin('student')).resolves.toMatchObject({
      id: 7,
    });
    expect(findOne).toHaveBeenLastCalledWith({
      where: { username: 'student' },
    });
  });
});
