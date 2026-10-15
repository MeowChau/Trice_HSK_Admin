import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import validationOptions from '../utils/validation-options';

describe('Authentication HTTP rate limits', () => {
  const credentials = {
    email: `${randomUUID()}@test.invalid`,
    username: randomUUID(),
    password: randomBytes(24).toString('base64url'),
  };
  let app: INestApplication;
  const service = {
    validateLogin: jest.fn().mockResolvedValue({ token: 'token' }),
    register: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 2 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationOptions));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('should stop repeated login attempts before executing authentication', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/email/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/auth/email/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(429);
    expect(service.validateLogin).toHaveBeenCalledTimes(2);
  });

  it('should reject malformed registration and prevent clients from assigning verification state', async () => {
    await request(app.getHttpServer())
      .post('/auth/email/register')
      .send({
        ...credentials,
        emailVerifiedAt: '2026-01-01',
        role: { id: 1 },
      })
      .expect(204);
    expect(service.register).toHaveBeenCalledWith(credentials);
    await request(app.getHttpServer())
      .post('/auth/email/register')
      .send({
        email: credentials.email,
        username: credentials.username,
        password: 'a'.repeat(73),
      })
      .expect(422);
  });
});
