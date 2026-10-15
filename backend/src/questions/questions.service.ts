import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from './infrastructure/persistence/relational/entities/question.entity';
import {
  QuestionSkillEnum,
  QuestionTypeEnum,
} from './infrastructure/persistence/relational/entities/question.enum';
import type { AuditActor } from '../audit-logs/types/audit-actor.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { validateAuthoredQuestion } from './question-validation';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    createData: Partial<QuestionEntity>,
    user?: AuditActor,
  ): Promise<QuestionEntity> {
    validateAuthoredQuestion(createData);
    const question = this.questionRepository.create(createData);
    const saved = await this.questionRepository.save(question);

    this.auditLogsService.record({
      userId: user?.id ? Number(user.id) : null,
      userName: user?.fullName || user?.firstName || 'Admin',
      userEmail: user?.email || null,
      action: 'CREATE',
      entityType: 'QUESTION',
      entityId: String(saved.id),
      summary: `Thêm mới câu hỏi #${saved.id} (${saved.skill} - HSK ${saved.hskLevel})`,
      newData: {
        id: saved.id,
        type: saved.type,
        skill: saved.skill,
        hskLevel: saved.hskLevel,
        difficulty: saved.difficulty,
        payload: saved.payload,
        correctAnswer: saved.correctAnswer,
      },
      changedFields: ['type', 'skill', 'hskLevel', 'payload', 'correctAnswer'],
    });

    return saved;
  }

  async findAll(): Promise<QuestionEntity[]> {
    return this.questionRepository.find();
  }

  async findWithPagination(params: {
    page?: number;
    limit?: number;
    hskLevel?: number;
    skill?: QuestionSkillEnum;
    type?: QuestionTypeEnum;
    difficulty?: number;
    isGameQuestion?: boolean;
    search?: string;
    sourceLesson?: number;
    preparation?: 'ready' | 'needs_audio' | 'needs_answer' | 'needs_review';
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const query = this.questionRepository.createQueryBuilder('q');
    if (params.sourceLesson !== undefined) {
      query.andWhere("q.payload->'source'->>'lesson' = :sourceLesson", {
        sourceLesson: String(params.sourceLesson),
      });
    }
    const noAudio =
      "(q.skill = 'LISTENING' AND COALESCE(q.payload->>'audioUrl', '') = '')";
    const noAnswer =
      "(COALESCE(q.\"correctAnswer\"->>'answer', '') = '' AND COALESCE(q.\"correctAnswer\"->>'rubric', '') = '')";
    const needsReview =
      "COALESCE(q.payload->>'reviewRequired', 'false') = 'true'";
    if (params.preparation === 'needs_audio') query.andWhere(noAudio);
    if (params.preparation === 'needs_answer') query.andWhere(noAnswer);
    if (params.preparation === 'needs_review') query.andWhere(needsReview);
    if (params.preparation === 'ready')
      query.andWhere(
        `NOT ${noAudio} AND NOT ${noAnswer} AND NOT (${needsReview})`,
      );

    if (params.hskLevel && params.hskLevel >= 1 && params.hskLevel <= 9) {
      query.andWhere('q.hskLevel = :hskLevel', { hskLevel: params.hskLevel });
    }

    if (params.skill) {
      query.andWhere('q.skill = :skill', { skill: params.skill });
    }

    if (params.type) {
      query.andWhere('q.type = :type', { type: params.type });
    }

    if (params.difficulty) {
      query.andWhere('q.difficulty = :difficulty', {
        difficulty: params.difficulty,
      });
    }

    if (params.isGameQuestion !== undefined) {
      query.andWhere('q.isGameQuestion = :isGame', {
        isGame: params.isGameQuestion,
      });
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query.andWhere(
        "(LOWER(q.payload->>'text') LIKE :term OR LOWER(q.payload->>'pinyin') LIKE :term OR LOWER(q.payload->>'translation') LIKE :term)",
        { term },
      );
    }

    query.orderBy('q.id', 'DESC');
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary() {
    const rows = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.skill', 'skill')
      .addSelect('q.hskLevel', 'hskLevel')
      .addSelect('q.isGameQuestion', 'isGameQuestion')
      .addSelect('COUNT(q.id)', 'count')
      .groupBy('q.skill')
      .addGroupBy('q.hskLevel')
      .addGroupBy('q.isGameQuestion')
      .getRawMany<{
        skill: string;
        hskLevel: number;
        isGameQuestion: boolean;
        count: string;
      }>();
    const skillsCount: Record<string, number> = {
      LISTENING: 0,
      READING: 0,
      WRITING: 0,
      SPEAKING: 0,
    };
    const hskLevelsCount: Record<number, number> = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i + 1, 0]),
    );
    let totalQuestions = 0,
      gameQuestionsCount = 0;
    for (const row of rows) {
      const count = Number(row.count);
      totalQuestions += count;
      if (row.isGameQuestion) gameQuestionsCount += count;
      if (Object.prototype.hasOwnProperty.call(skillsCount, row.skill))
        skillsCount[row.skill] += count;
      if (Object.prototype.hasOwnProperty.call(hskLevelsCount, row.hskLevel))
        hskLevelsCount[row.hskLevel] += count;
    }
    return { totalQuestions, skillsCount, hskLevelsCount, gameQuestionsCount };
  }

  async findOne(id: number): Promise<QuestionEntity> {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  async update(
    id: number,
    updateData: Partial<QuestionEntity>,
    user?: AuditActor,
  ): Promise<QuestionEntity> {
    const oldQuestion = await this.findOne(id);
    validateAuthoredQuestion({ ...oldQuestion, ...updateData });
    const oldData = {
      type: oldQuestion.type,
      skill: oldQuestion.skill,
      hskLevel: oldQuestion.hskLevel,
      payload: oldQuestion.payload,
      correctAnswer: oldQuestion.correctAnswer,
    };
    const merged = this.questionRepository.merge(oldQuestion, updateData);
    const saved = await this.questionRepository.save(merged);

    this.auditLogsService.record({
      userId: user?.id ? Number(user.id) : null,
      userName: user?.fullName || user?.firstName || 'Admin',
      userEmail: user?.email || null,
      action: 'UPDATE',
      entityType: 'QUESTION',
      entityId: String(id),
      summary: `Chỉnh sửa câu hỏi #${id} (${saved.skill} - HSK ${saved.hskLevel})`,
      oldData,
      newData: {
        type: saved.type,
        skill: saved.skill,
        hskLevel: saved.hskLevel,
        payload: saved.payload,
        correctAnswer: saved.correctAnswer,
      },
      changedFields: ['payload', 'correctAnswer', 'difficulty'],
    });

    return saved;
  }

  async remove(id: number, user?: AuditActor): Promise<void> {
    const oldQuestion = await this.findOne(id);
    await this.questionRepository.delete(id);

    this.auditLogsService.record({
      userId: user?.id ? Number(user.id) : null,
      userName: user?.fullName || user?.firstName || 'Admin',
      userEmail: user?.email || null,
      action: 'DELETE',
      entityType: 'QUESTION',
      entityId: String(id),
      summary: `Xóa câu hỏi #${id} (${oldQuestion.skill} - HSK ${oldQuestion.hskLevel})`,
      oldData: {
        type: oldQuestion.type,
        skill: oldQuestion.skill,
        hskLevel: oldQuestion.hskLevel,
        payload: oldQuestion.payload,
      },
      changedFields: ['deleted'],
    });
  }
}
