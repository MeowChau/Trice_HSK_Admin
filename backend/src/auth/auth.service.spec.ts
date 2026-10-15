import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnprocessableEntityException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/domain/user';
import { AuthUpdateDto } from './dto/auth-update.dto';

describe('AuthService email confirmation and account access', () => {
  let service: AuthService;
  const users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByLogin: jest.fn(),
    findBySocialIdAndProvider: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const sessions = { create: jest.fn(), updateByHash: jest.fn() };
  const mail = {
    userSignUp: jest.fn(),
    confirmNewEmail: jest.fn(),
    forgotPassword: jest.fn(),
  };
  const jwt = { verifyAsync: jest.fn(), signAsync: jest.fn() };
  const user = () =>
    Object.assign(new User(), {
      id: 7,
      email: 'student@example.com',
      provider: 'email',
      role: { id: 2 },
      status: { id: 3 },
      emailVerifiedAt: null,
    });
  const token = (properties: Record<string, unknown> = {}) => ({
    purpose: 'confirm-email',
    confirmEmailUserId: 7,
    email: 'student@example.com',
    ...properties,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findById.mockResolvedValue(user());
    users.findByLogin.mockResolvedValue(user());
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(user());
    users.findBySocialIdAndProvider.mockResolvedValue(null);
    sessions.create.mockResolvedValue({ id: 10 });
    jwt.verifyAsync.mockResolvedValue(token());
    jwt.signAsync.mockResolvedValue('signed-token');
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: SessionService, useValue: sessions },
        { provide: MailService, useValue: mail },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'auth.uniformErrors'
                ? false
                : key.endsWith('Expires') || key === 'auth.expires'
                  ? '1h'
                  : 'test-secret',
          },
        },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('should record verification while preserving pending approval', async () => {
    await service.confirmEmail('hash');
    expect(users.update).toHaveBeenCalledWith(7, {
      emailVerifiedAt: expect.any(Date),
    });
  });

  it.each([1, 2, 3])(
    'should preserve account status %s when confirming email',
    async (status) => {
      users.findById.mockResolvedValue({ ...user(), status: { id: status } });
      await service.confirmEmail('hash');
      expect(users.update.mock.calls[0][1]).not.toHaveProperty('status');
    },
  );

  it('should permit repeated confirmation without changing the verification timestamp', async () => {
    users.findById.mockResolvedValue({
      ...user(),
      emailVerifiedAt: new Date(),
    });
    await service.confirmEmail('hash');
    expect(users.update).not.toHaveBeenCalled();
  });

  it.each([
    { purpose: 'change-email', newEmail: 'new@example.com' },
    { purpose: undefined },
    { confirmEmailUserId: undefined },
    { confirmEmailUserId: -1 },
    { confirmEmailUserId: {} },
    { email: 'previous@example.com' },
  ])(
    'should reject malformed or mismatched registration tokens %j',
    async (properties) => {
      jwt.verifyAsync.mockResolvedValue(token(properties));
      await expect(service.confirmEmail('hash')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(users.update).not.toHaveBeenCalled();
    },
  );

  it('should reject invalid signatures', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('Invalid signature'));
    await expect(service.confirmEmail('hash')).rejects.toMatchObject({
      status: 422,
    });
  });

  it('should require a change-email token at the change endpoint', async () => {
    await expect(service.confirmNewEmail('hash')).rejects.toMatchObject({
      status: 422,
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it('should confirm the new email without activating an inactive account', async () => {
    jwt.verifyAsync.mockResolvedValue(
      token({ purpose: 'change-email', newEmail: 'new@example.com' }),
    );
    users.findById.mockResolvedValue({ ...user(), status: { id: 2 } });
    await service.confirmNewEmail('hash');
    expect(users.update).toHaveBeenCalledWith(7, {
      email: 'new@example.com',
      emailVerifiedAt: expect.any(Date),
    });
  });

  it('should reject an old change link after the account email changes', async () => {
    jwt.verifyAsync.mockResolvedValue(
      token({ purpose: 'change-email', newEmail: 'new@example.com' }),
    );
    users.findById.mockResolvedValue({
      ...user(),
      email: 'changed@example.com',
    });
    await expect(service.confirmNewEmail('hash')).rejects.toMatchObject({
      status: 422,
    });
  });

  it('should bind registration tokens to the account email and token purpose', async () => {
    await service.register({
      email: 'student@example.com',
      password: 'secret',
      username: 'student',
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(token(), expect.any(Object));
  });

  it('should resend a current confirmation link for an unverified email account', async () => {
    users.findByEmail.mockResolvedValue(user());
    await service.resendConfirmation('student@example.com');
    expect(jwt.signAsync).toHaveBeenCalledWith(token(), expect.any(Object));
    expect(mail.userSignUp).toHaveBeenCalledWith({
      to: 'student@example.com',
      data: { hash: 'signed-token' },
    });
    expect(users.update).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'verified', 'social'])(
    'should return the same response without sending mail for %s accounts',
    async (kind) => {
      users.findByEmail.mockResolvedValue(
        kind === 'unknown'
          ? null
          : {
              ...user(),
              provider: kind === 'social' ? 'google' : 'email',
              emailVerifiedAt: kind === 'verified' ? new Date() : null,
            },
      );
      await expect(
        service.resendConfirmation('student@example.com'),
      ).resolves.toBeUndefined();
      expect(mail.userSignUp).not.toHaveBeenCalled();
    },
  );

  it.each([2, 3, undefined])(
    'should deny email login for account status %s',
    async (status) => {
      users.findByLogin.mockResolvedValue({
        ...user(),
        password: await bcrypt.hash('secret', 4),
        status: status ? { id: status } : undefined,
      });
      await expect(
        service.validateLogin({ email: 'student', password: 'secret' }),
      ).rejects.toMatchObject({ status: 422 });
      expect(sessions.create).not.toHaveBeenCalled();
      expect(users.findByLogin).toHaveBeenCalledWith('student');
    },
  );

  it.each([2, 3])(
    'should deny social login for account status %s without changing its provider',
    async (status) => {
      users.findByEmail.mockResolvedValue({
        ...user(),
        status: { id: status },
      });
      await expect(
        service.validateSocialLogin('google', {
          id: 'social-id',
          email: 'student@example.com',
          emailVerified: true,
        }),
      ).rejects.toMatchObject({ status: 422 });
      expect(sessions.create).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
    },
  );

  it('should register verified social accounts as pending without issuing a session', async () => {
    await expect(
      service.validateSocialLogin('google', {
        id: 'social-id',
        email: 'student@example.com',
        emailVerified: true,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { id: 3 },
        emailVerifiedAt: expect.any(Date),
      }),
    );
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('should issue a session for active social accounts', async () => {
    users.findBySocialIdAndProvider.mockResolvedValue({
      ...user(),
      status: { id: 1 },
      provider: 'google',
    });
    await expect(
      service.validateSocialLogin('google', {
        id: 'social-id',
        email: 'student@example.com',
        emailVerified: true,
      }),
    ).resolves.toMatchObject({ token: 'signed-token' });
    expect(sessions.create).toHaveBeenCalledTimes(1);
  });

  it('should refuse refresh for inactive accounts', async () => {
    sessions.updateByHash.mockResolvedValue({ id: 10, user: { id: 7 } });
    await expect(
      service.refreshToken({ sessionId: 10, hash: 'old' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('should keep caller DTOs intact when updating a profile', async () => {
    const dto: AuthUpdateDto = {
      email: 'new@example.com',
      firstName: 'Student',
    };
    await service.update({ id: 7, sessionId: 10, iat: 1, exp: 100 }, dto);
    expect(dto).toEqual({ email: 'new@example.com', firstName: 'Student' });
    expect(users.update).toHaveBeenCalledWith(
      7,
      { firstName: 'Student' },
      { excludeSessionId: 10 },
    );
    expect(jwt.signAsync).toHaveBeenCalledWith(
      token({ purpose: 'change-email', newEmail: 'new@example.com' }),
      expect.any(Object),
    );
  });
});
