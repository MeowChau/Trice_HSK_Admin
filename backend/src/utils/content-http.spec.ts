import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import { ExamsController } from '../exams/exams.controller';
import { ExamsService } from '../exams/exams.service';
import { VocabularyController } from '../vocabulary/vocabulary.controller';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { QuestionsController } from '../questions/questions.controller';
import { QuestionsService } from '../questions/questions.service';
import { PracticeSetsController } from '../practice-sets/practice-sets.controller';
import { PracticeSetsService } from '../practice-sets/practice-sets.service';
import validationOptions from './validation-options';
import type { RequestWithUser } from './types/request-with-user.type';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';

describe('Content HTTP authorization and validation', () => {
  let app: INestApplication;
  const exams = {
    create: jest.fn(),
    findAll: jest.fn(),
    remove: jest.fn(),
    addSection: jest.fn(),
    addQuestionsToSection: jest.fn(),
    getDetails: jest.fn(),
    update: jest.fn(),
  };
  const vocab = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    batchAssign: jest.fn(),
    findMany: jest.fn(),
  };
  const questions = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findWithPagination: jest.fn(),
  };
  const practice = {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setQuestions: jest.fn(),
  };
  const headers = {
    admin: 'Bearer admin',
    teacher: 'Bearer teacher',
    student: 'Bearer student',
    blocked: 'Bearer blocked',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        ExamsController,
        VocabularyController,
        QuestionsController,
        PracticeSetsController,
      ],
      providers: [
        { provide: ExamsService, useValue: exams },
        { provide: VocabularyService, useValue: vocab },
        { provide: QuestionsService, useValue: questions },
        { provide: PracticeSetsService, useValue: practice },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx
            .switchToHttp()
            .getRequest<RequestWithUser<JwtPayloadType>>();
          const auth = req.headers.authorization;
          if (!Object.values(headers).includes(auth || ''))
            throw new UnauthorizedException();
          const role =
            auth === headers.admin ? 1 : auth === headers.teacher ? 3 : 2;
          req.user = {
            id: 7,
            role: { id: role },
            status: { id: auth === headers.blocked ? 2 : 1 },
            sessionId: 10,
            iat: 1,
            exp: 9999999999,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(validationOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const writes: [string, string, object][] = [
    ['post', '/exams', { title: 'HSK 1', hskLevel: 1 }],
    [
      'put',
      '/exams/1',
      {
        title: 'HSK 1',
        hskLevel: 1,
        updatedAt: '2026-10-12T00:00:00.000Z',
        sections: [],
      },
    ],
    ['delete', '/exams/1', {}],
    ['post', '/exams/1/sections', { title: 'Listening', order: 0 }],
    ['post', '/exams/sections/1/questions', { questions: [] }],
    [
      'post',
      '/vocabulary',
      { hanzi: '你', pinyin: 'nǐ', meaning: 'bạn', hskLevel: 1 },
    ],
    ['patch', '/vocabulary/1', { meaning: 'bạn' }],
    ['delete', '/vocabulary/1', {}],
    ['post', '/vocabulary/batch-assign', { vocabIds: [1], topic: null }],
    [
      'post',
      '/questions',
      {
        type: 'MULTIPLE_CHOICE',
        skill: 'READING',
        difficulty: 1,
        hskLevel: 1,
        payload: {},
      },
    ],
    ['patch', '/questions/1', { difficulty: 2 }],
    ['delete', '/questions/1', {}],
    [
      'post',
      '/practice-sets',
      { title: 'Reading', topic: 'HSK1-L01', skill: 'READING', hskLevel: 1 },
    ],
    ['patch', '/practice-sets/1', { title: 'Updated' }],
    ['delete', '/practice-sets/1', {}],
    ['put', '/practice-sets/1/questions', { questions: [] }],
  ];

  function send(method: string, url: string) {
    const agent = request(app.getHttpServer());
    if (method === 'post') return agent.post(url);
    if (method === 'patch') return agent.patch(url);
    if (method === 'put') return agent.put(url);
    return agent.delete(url);
  }

  it.each(writes)(
    'should protect %s %s from anonymous and student writes',
    async (method, url, body) => {
      await send(method, url).send(body).expect(401);
      await send(method, url)
        .set('Authorization', headers.student)
        .send(body)
        .expect(403);
      await send(method, url)
        .set('Authorization', headers.blocked)
        .send(body)
        .expect(403);
    },
  );

  it.each(['admin', 'teacher'] as const)(
    'should allow %s content creation',
    async (role) => {
      await request(app.getHttpServer())
        .post('/exams')
        .set('Authorization', headers[role])
        .send({ title: 'HSK 1', hskLevel: 1 })
        .expect(201);
      expect(exams.create).toHaveBeenCalledWith({
        title: 'HSK 1',
        hskLevel: 1,
      });
    },
  );

  it('should strip persistence fields instead of allowing clients to overwrite IDs', async () => {
    await request(app.getHttpServer())
      .post('/exams')
      .set('Authorization', headers.admin)
      .send({
        id: 99,
        title: 'HSK 1',
        hskLevel: 1,
        sections: [],
        deletedAt: '2026-01-01',
      })
      .expect(201);
    expect(exams.create).toHaveBeenCalledWith({ title: 'HSK 1', hskLevel: 1 });
  });

  it('should reject empty content after trimming whitespace', async () => {
    await request(app.getHttpServer())
      .post('/vocabulary')
      .set('Authorization', headers.admin)
      .send({ hanzi: '  ', pinyin: 'nǐ', meaning: 'bạn', hskLevel: 1 })
      .expect(422);
    expect(vocab.create).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.2', 'Infinity', 'nope'])(
    'should reject invalid pagination page %s',
    async (page) => {
      await request(app.getHttpServer())
        .get('/exams')
        .query({ page })
        .expect(422);
      expect(exams.findAll).not.toHaveBeenCalled();
    },
  );

  it('should convert valid query strings to numbers and real booleans', async () => {
    await request(app.getHttpServer())
      .get('/questions')
      .set('Authorization', headers.admin)
      .query({ page: '2', limit: '20', hskLevel: '3', isGameQuestion: 'false' })
      .expect(200);
    expect(questions.findWithPagination).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      hskLevel: 3,
      isGameQuestion: false,
    });
  });

  it('should reject invalid HSK levels, boolean values and oversized limits', async () => {
    for (const query of [
      { hskLevel: 10 },
      { isGameQuestion: 'anything' },
      { limit: 101 },
    ]) {
      await request(app.getHttpServer())
        .get('/questions')
        .set('Authorization', headers.admin)
        .query(query)
        .expect(422);
    }
    expect(questions.findWithPagination).not.toHaveBeenCalled();
  });

  it('should reject malformed resource IDs before querying the database', async () => {
    await request(app.getHttpServer()).get('/exams/nope').expect(400);
    expect(exams.getDetails).not.toHaveBeenCalled();
  });

  it('should keep exam details isolated by ID and fresh across requests', async () => {
    exams.getDetails.mockImplementation((id: number) => ({
      id,
      title: `Exam ${id}`,
      sections: [],
    }));
    await request(app.getHttpServer())
      .get('/exams/1')
      .expect(200, { id: 1, title: 'Exam 1', sections: [] });
    await request(app.getHttpServer())
      .get('/exams/2')
      .expect(200, { id: 2, title: 'Exam 2', sections: [] });
    exams.getDetails.mockImplementation((id: number) => ({
      id,
      title: 'Updated',
      sections: [],
    }));
    await request(app.getHttpServer())
      .get('/exams/1')
      .expect(200, { id: 1, title: 'Updated', sections: [] });
  });

  it('should protect editor answers while public details omit answers, transcripts and raw OCR', async () => {
    const data = {
      id: 1,
      title: 'Mock',
      sections: [
        {
          id: 2,
          title: 'Reading',
          order: 1,
          audioUrl: null,
          sectionQuestions: [
            {
              questionId: 5,
              order: 1,
              question: {
                id: 5,
                type: 'MULTIPLE_CHOICE',
                skill: 'READING',
                hskLevel: 1,
                payload: {
                  text: 'Read',
                  imageUrl: '/api/v1/files/test.webp',
                  options: ['A', 'B'],
                  transcript: 'hidden',
                  source: { ocrText: 'hidden answer' },
                  unknownFutureKey: 'hidden',
                },
                correctAnswer: { answer: 'B' },
              },
            },
          ],
        },
      ],
    };
    exams.getDetails.mockResolvedValue(data);
    const response = await request(app.getHttpServer())
      .get('/exams/1')
      .expect(200);
    const question = response.body.sections[0].sectionQuestions[0].question;
    expect(question.payload).toEqual({
      text: 'Read',
      imageUrl: '/api/v1/files/test.webp',
      options: ['A', 'B'],
    });
    expect(question.correctAnswer).toBeUndefined();
    await request(app.getHttpServer()).get('/exams/1/editor').expect(401);
    await request(app.getHttpServer())
      .get('/exams/1/editor')
      .set('Authorization', headers.student)
      .expect(403);
    await request(app.getHttpServer())
      .get('/exams/1/editor')
      .set('Authorization', headers.admin)
      .expect(200, data);
    await request(app.getHttpServer()).get('/questions/5').expect(401);
    await request(app.getHttpServer())
      .get('/questions/5')
      .set('Authorization', headers.student)
      .expect(403);
  });

  it('should reject duplicate links and invalid nested question fields', async () => {
    for (const body of [
      {
        questions: [
          { questionId: 1, order: 0 },
          { questionId: 1, order: 1 },
        ],
      },
      { questions: [{ questionId: 'bad', order: -1 }] },
    ]) {
      await request(app.getHttpServer())
        .put('/practice-sets/1/questions')
        .set('Authorization', headers.admin)
        .send(body)
        .expect(422);
    }
    expect(practice.setQuestions).not.toHaveBeenCalled();
  });

  it('should reject null for mandatory update properties and permit clearing nullable ones', async () => {
    await request(app.getHttpServer())
      .patch('/questions/1')
      .set('Authorization', headers.admin)
      .send({ payload: null })
      .expect(422);
    await request(app.getHttpServer())
      .patch('/questions/1')
      .set('Authorization', headers.admin)
      .send({ correctAnswer: null })
      .expect(200);
    expect(questions.update).toHaveBeenCalledWith(
      1,
      { correctAnswer: null },
      expect.objectContaining({ id: 7 }),
    );
  });
});
