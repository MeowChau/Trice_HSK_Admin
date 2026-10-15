import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayloadType } from './types/jwt-payload.type';
import { SessionService } from '../../session/session.service';
import { UsersService } from '../../users/users.service';

describe('JwtStrategy session validation', () => {
  let strategy: JwtStrategy;
  const sessions = { findById: jest.fn() };
  const users = { findById: jest.fn() };
  const payload: JwtPayloadType = {
    id: 7,
    sessionId: 10,
    role: { id: 1 },
    status: { id: 1 },
    iat: 1,
    exp: 9999999999,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    sessions.findById.mockResolvedValue({ id: 10, user: { id: 7 } });
    users.findById.mockResolvedValue({
      id: 7,
      role: { id: 2 },
      status: { id: 2 },
    });
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'unit-test-secret' },
        },
        { provide: SessionService, useValue: sessions },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    strategy = module.get(JwtStrategy);
  });

  it('should reject an access token after logout removes its session', async () => {
    sessions.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject a session belonging to another user', async () => {
    sessions.findById.mockResolvedValue({ id: 10, user: { id: 8 } });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject a deleted account', async () => {
    users.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should use current role and status instead of stale token permissions', async () => {
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      id: 7,
      role: { id: 2 },
      status: { id: 2 },
    });
  });

  it('should reject a token without a session ID', async () => {
    await expect(
      strategy.validate({ ...payload, sessionId: '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.findById).not.toHaveBeenCalled();
  });
});
