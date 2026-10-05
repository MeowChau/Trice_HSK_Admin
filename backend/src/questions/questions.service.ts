import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionEntity } from './infrastructure/persistence/relational/entities/question.entity';
import { QuestionSkillEnum, QuestionTypeEnum } from './infrastructure/persistence/relational/entities/question.enum';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(createData: Partial<QuestionEntity>, user?: any): Promise<QuestionEntity> {
    const question = this.questionRepository.create(createData);
    const saved = await this.questionRepository.save(question);

    this.auditLogsService
      .createLog({
        userId: user?.id || null,
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
      })
      .catch(() => {});

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
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    const skip = (page - 1) * limit;

    const query = this.questionRepository.createQueryBuilder('q');

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
        '(LOWER(q.payload->>\'text\') LIKE :term OR LOWER(q.payload->>\'pinyin\') LIKE :term OR LOWER(q.payload->>\'translation\') LIKE :term)',
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
    const totalQuestions = await this.questionRepository.count();

    const skillsRaw = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.skill', 'skill')
      .addSelect('COUNT(q.id)', 'count')
      .groupBy('q.skill')
      .getRawMany();

    const skillsCount: Record<string, number> = {
      LISTENING: 0,
      READING: 0,
      WRITING: 0,
      SPEAKING: 0,
    };
    skillsRaw.forEach((r) => {
      if (r.skill && skillsCount.hasOwnProperty(r.skill)) {
        skillsCount[r.skill] = parseInt(r.count, 10);
      }
    });

    const hskRaw = await this.questionRepository
      .createQueryBuilder('q')
      .select('q.hskLevel', 'hskLevel')
      .addSelect('COUNT(q.id)', 'count')
      .groupBy('q.hskLevel')
      .getRawMany();

    const hskLevelsCount: Record<number, number> = {};
    for (let i = 1; i <= 9; i++) hskLevelsCount[i] = 0;
    hskRaw.forEach((r) => {
      const lvl = parseInt(r.hskLevel, 10);
      if (lvl >= 1 && lvl <= 9) {
        hskLevelsCount[lvl] = parseInt(r.count, 10);
      }
    });

    const gameQuestionsCount = await this.questionRepository.count({
      where: { isGameQuestion: true },
    });

    return {
      totalQuestions,
      skillsCount,
      hskLevelsCount,
      gameQuestionsCount,
    };
  }

  async findOne(id: number): Promise<QuestionEntity> {
    const question = await this.questionRepository.findOne({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }
    return question;
  }

  async update(id: number, updateData: Partial<QuestionEntity>, user?: any): Promise<QuestionEntity> {
    const oldQuestion = await this.findOne(id);
    const merged = this.questionRepository.merge(oldQuestion, updateData);
    const saved = await this.questionRepository.save(merged);

    this.auditLogsService
      .createLog({
        userId: user?.id || null,
        userName: user?.fullName || user?.firstName || 'Admin',
        userEmail: user?.email || null,
        action: 'UPDATE',
        entityType: 'QUESTION',
        entityId: String(id),
        summary: `Chỉnh sửa câu hỏi #${id} (${saved.skill} - HSK ${saved.hskLevel})`,
        oldData: {
          type: oldQuestion.type,
          skill: oldQuestion.skill,
          hskLevel: oldQuestion.hskLevel,
          payload: oldQuestion.payload,
          correctAnswer: oldQuestion.correctAnswer,
        },
        newData: {
          type: saved.type,
          skill: saved.skill,
          hskLevel: saved.hskLevel,
          payload: saved.payload,
          correctAnswer: saved.correctAnswer,
        },
        changedFields: ['payload', 'correctAnswer', 'difficulty'],
      })
      .catch(() => {});

    return saved;
  }

  async remove(id: number, user?: any): Promise<void> {
    const oldQuestion = await this.findOne(id);
    await this.questionRepository.delete(id);

    this.auditLogsService
      .createLog({
        userId: user?.id || null,
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
      })
      .catch(() => {});
  }
}
