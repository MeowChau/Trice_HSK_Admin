import { Controller, Get, INestApplication, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import request from 'supertest';
import { DatabaseExceptionFilter } from './database-exception.filter';

@Controller('database-errors')
class DatabaseErrorsController {
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
});
