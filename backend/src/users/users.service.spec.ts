import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { FilesService } from '../files/files.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SessionService } from '../session/session.service';

describe('UsersService persistence and credentials', () => {
  let service: UsersService;
  const repo = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    remove: jest.fn(),
  };
  const sessions = {
    deleteByUserId: jest.fn(),
    deleteByUserIdWithExclude: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo.findById.mockResolvedValue({
      id: 7,
      email: 'old@example.com',
      emailVerifiedAt: new Date('2026-01-01'),
      password: 'old-hash',
      role: { id: 2 },
      status: { id: 1 },
      currentHskLevel: 1,
    });
    repo.findByEmail.mockResolvedValue(null);
    repo.create.mockImplementation((data: object) => ({ ...data, id: 7 }));
    repo.update.mockImplementation((id: number, data: object) => ({
      ...data,
      id,
    }));
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: repo },
        { provide: FilesService, useValue: {} },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        { provide: SessionService, useValue: sessions },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('should persist study goals and an explicitly provided student code when creating an account', async () => {
    await service.create({
      email: 'student@example.com',
      password: 'testing-password',
      studentCode: 99,
      currentHskLevel: 2,
      targetHskLevel: 5,
      dailyStudyTime: 30,
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        studentCode: 99,
        currentHskLevel: 2,
        targetHskLevel: 5,
        dailyStudyTime: 30,
      }),
    );
  });

  it('should persist changed study goals when updating an account', async () => {
    await service.update(7, {
      currentHskLevel: 3,
      targetHskLevel: 6,
      dailyStudyTime: 45,
    });
    expect(repo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        currentHskLevel: 3,
        targetHskLevel: 6,
        dailyStudyTime: 45,
      }),
    );
    expect(sessions.deleteByUserId).not.toHaveBeenCalled();
  });

  it('should hash admin password changes and revoke the old sessions', async () => {
    await service.update(7, { password: 'new-password' });
    const update = repo.update.mock.calls[0][1] as { password: string };
    expect(await bcrypt.compare('new-password', update.password)).toBe(true);
    expect(sessions.deleteByUserId).toHaveBeenCalledWith({ userId: 7 });
  });

  it('should preserve the current session for a self-service password change', async () => {
    await service.update(
      7,
      { password: 'new-password' },
      { excludeSessionId: 10 },
    );
    expect(sessions.deleteByUserIdWithExclude).toHaveBeenCalledWith({
      userId: 7,
      excludeSessionId: 10,
    });
    expect(sessions.deleteByUserId).not.toHaveBeenCalled();
  });

  it('should use random credentials instead of a shared default password', async () => {
    const first = await service.create({ email: 'one@example.com' });
    const second = await service.create({ email: 'two@example.com' });
    expect(await bcrypt.compare('123456', first.password!)).toBe(false);
    expect(first.password).not.toEqual(second.password);
  });

  it('should return a temporary password that matches the stored hash and revoke sessions', async () => {
    const password = await service.issueTempPassword(7);
    const update = repo.update.mock.calls[0][1] as { password: string };
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(await bcrypt.compare(password, update.password)).toBe(true);
    expect(sessions.deleteByUserId).toHaveBeenCalledWith({ userId: 7 });
  });

  it('should clear verification when an admin changes the email', async () => {
    await service.update(7, { email: 'new@example.com' });
    expect(repo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        email: 'new@example.com',
        emailVerifiedAt: null,
      }),
    );
  });

  it('should preserve verification when the email remains unchanged', async () => {
    await service.update(7, { email: 'old@example.com' });
    expect(repo.update.mock.calls[0][1].emailVerifiedAt).toBeUndefined();
  });

  it('should set verification only through an internal confirmed email update', async () => {
    const verifiedAt = new Date();
    await service.update(7, {
      email: 'new@example.com',
      emailVerifiedAt: verifiedAt,
    });
    expect(repo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ emailVerifiedAt: verifiedAt }),
    );
  });

  it('should revoke sessions when removing an account', async () => {
    await service.remove(7);
    expect(repo.remove).toHaveBeenCalledWith(7);
    expect(sessions.deleteByUserId).toHaveBeenCalledWith({ userId: 7 });
  });
});
