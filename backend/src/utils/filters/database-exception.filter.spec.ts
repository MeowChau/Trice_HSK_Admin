import {
  Controller,
  Get,
  INestApplication,
  Param,
  HttpException,
  BadRequestException,
  ValidationPipe,
  Post,
  Body,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import request from 'supertest';
import { IsEmail } from 'class-validator';
import validationOptions from '../validation-options';
import { DatabaseExceptionFilter } from './database-exception.filter';

class ExampleDto {
  @IsEmail() email: string;
}
@Controller('database-errors')
class DatabaseErrorsController {
  @Get('http/:status')
  http(@Param('status') status: string) {
    throw new HttpException('denied', Number(status));
  }
  @Post('validate')
  validate(@Body() dto: ExampleDto) {
    return dto;
  }
  @Get('legacy')
  legacy() {
    throw new BadRequestException({ errors: { email: 'emailAlreadyExists' } });
  }
  @Get(':code')
  fail(@Param('code') code: string) {
    throw new QueryFailedError(
      'INSERT INTO "user" VALUES ($1)',
      ['sensitive-password'],
      Object.assign(new Error('private database details'), { code }),
    );
  }
}

describe('Database exception HTTP responses', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DatabaseErrorsController],
      providers: [{ provide: APP_FILTER, useClass: DatabaseExceptionFilter }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe(validationOptions));
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['23505', 409],
    ['23503', 422],
    ['23502', 422],
    ['23514', 422],
    ['22003', 400],
    ['22P02', 400],
    ['XX000', 500],
  ])(
    'should map PostgreSQL error %s to HTTP %s without leaking details',
    async (code, status) => {
      const response = await request(app.getHttpServer())
        .get(`/database-errors/${code}`)
        .expect(status);
      expect(JSON.stringify(response.body)).not.toMatch(
        /INSERT|sensitive-password|private database details/,
      );
    },
  );
  it.each([400, 401, 403, 404, 409, 422, 429, 503])(
    'normalizes HTTP %s without changing its meaning',
    async (status) => {
      const r = await request(app.getHttpServer())
        .get(`/database-errors/http/${status}`)
        .expect(status);
      expect(r.body).toMatchObject({
        statusCode: status,
        status,
        code: expect.any(String),
        message: expect.any(String),
      });
    },
  );
  it('should validate DTO fields as HTTP 400 and retains legacy errors for app/admin', async () => {
    const r = await request(app.getHttpServer())
      .post('/database-errors/validate')
      .send({ email: 'invalid' })
      .expect(400);
    expect(r.body.errors.email).toContain('email');
    expect(r.body.code).toBe('BAD_REQUEST');
    const legacy = await request(app.getHttpServer())
      .get('/database-errors/legacy')
      .expect(400);
    expect(legacy.body.errors.email).toBe('emailAlreadyExists');
  });
});
