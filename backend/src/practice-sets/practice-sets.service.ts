import { STANDARD_TOPICS } from './data/standard-topics';
export { STANDARD_TOPICS } from './data/standard-topics';
import {
  Injectable,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PracticeSetEntity } from './infrastructure/persistence/relational/entities/practice-set.entity';
import { PracticeSetQuestionEntity } from './infrastructure/persistence/relational/entities/practice-set-question.entity';
import { QuestionSkillEnum } from '../questions/infrastructure/persistence/relational/entities/question.enum';
import type { AuditActor } from '../audit-logs/types/audit-actor.type';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { VocabularyEntity } from '../offline-games/infrastructure/persistence/relational/entities/vocabulary.entity';

@Injectable()
export class PracticeSetsService {
  constructor(
    @InjectRepository(PracticeSetEntity)
    private readonly practiceSetRepository: Repository<PracticeSetEntity>,
    @InjectRepository(PracticeSetQuestionEntity)
    private readonly practiceSetQuestionRepository: Repository<PracticeSetQuestionEntity>,
    @InjectRepository(VocabularyEntity)
    private readonly vocabRepository: Repository<VocabularyEntity>,
    @Optional()
    @Inject(AuditLogsService)
    private readonly auditLogsService?: AuditLogsService,
  ) {}

  async create(
    createData: Partial<PracticeSetEntity>,
    user?: AuditActor,
  ): Promise<PracticeSetEntity> {
    const practiceSet = this.practiceSetRepository.create(createData);
    const saved = await this.practiceSetRepository.save(practiceSet);

    if (this.auditLogsService) {
      this.auditLogsService.record({
        userId: user?.id ? Number(user.id) : null,
        userName: user?.fullName || user?.firstName || 'Admin',
        userEmail: user?.email || null,
        action: 'CREATE',
        entityType: 'PRACTICE_SET',
        entityId: String(saved.id),
        summary: `Tạo bài luyện tập "${saved.title}" (${saved.skill} - HSK ${saved.hskLevel})`,
        newData: saved,
      });
    }

    return saved;
  }

  async update(
    id: number,
    updateData: Partial<PracticeSetEntity>,
    user?: AuditActor,
  ): Promise<PracticeSetEntity> {
    const existing = await this.practiceSetRepository.findOne({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Practice set with ID ${id} not found`);
    }

    const oldData = { ...existing };
    Object.assign(existing, updateData);
    const saved = await this.practiceSetRepository.save(existing);

    if (this.auditLogsService) {
      this.auditLogsService.record({
        userId: user?.id ? Number(user.id) : null,
        userName: user?.fullName || user?.firstName || 'Admin',
        userEmail: user?.email || null,
        action: 'UPDATE',
        entityType: 'PRACTICE_SET',
        entityId: String(id),
        summary: `Cập nhật bài luyện tập "${saved.title}"`,
        oldData,
        newData: saved,
      });
    }

    return saved;
  }

  async remove(id: number, user?: AuditActor): Promise<void> {
    const existing = await this.practiceSetRepository.findOne({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Practice set with ID ${id} not found`);
    }

    // PostgreSQL cascades the linked rows in the same statement.
    const result = await this.practiceSetRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Practice set with ID ${id} not found`);
    }

    if (this.auditLogsService) {
      this.auditLogsService.record({
        userId: user?.id ? Number(user.id) : null,
        userName: user?.fullName || user?.firstName || 'Admin',
        userEmail: user?.email || null,
        action: 'DELETE',
        entityType: 'PRACTICE_SET',
        entityId: String(id),
        summary: `Xóa bài luyện tập "${existing.title}" (${existing.skill} - HSK ${existing.hskLevel})`,
        oldData: existing,
      });
    }
  }

  async setQuestions(
    practiceSetId: number,
    questions: { questionId: number; order: number }[],
  ): Promise<void> {
    const practiceSet = await this.practiceSetRepository.findOne({
      where: { id: practiceSetId },
    });
    if (!practiceSet) {
      throw new NotFoundException(
        `Practice Set with ID ${practiceSetId} not found`,
      );
    }

    await this.practiceSetRepository.manager.transaction(async (manager) => {
      // Serialize replacements of the same set so concurrent writes cannot mix.
      const existing = await manager.findOne(PracticeSetEntity, {
        where: { id: practiceSetId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) {
        throw new NotFoundException(
          `Practice Set with ID ${practiceSetId} not found`,
        );
      }
      const repository = manager.getRepository(PracticeSetQuestionEntity);
      await repository.delete({ practiceSetId });
      if (questions.length > 0) {
        await repository.save(
          questions.map((question) =>
            repository.create({ practiceSetId, ...question }),
          ),
        );
      }
    });
  }

  async findWithPagination(params?: {
    page?: number;
    limit?: number;
    skill?: QuestionSkillEnum;
    hskLevel?: number;
    topic?: string;
    search?: string;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 10));
    const skip = (page - 1) * limit;

    const query = this.practiceSetRepository
      .createQueryBuilder('practiceSet')
      .leftJoinAndSelect('practiceSet.practiceSetQuestions', 'psq')
      .leftJoinAndSelect('psq.question', 'question');

    if (params?.skill) {
      query.andWhere('practiceSet.skill = :skill', { skill: params.skill });
    }

    if (params?.hskLevel && params.hskLevel >= 1 && params.hskLevel <= 9) {
      query.andWhere('practiceSet.hskLevel = :hskLevel', {
        hskLevel: params.hskLevel,
      });
    }

    if (params?.topic && params.topic !== 'ALL') {
      query.andWhere('practiceSet.topic = :topic', { topic: params.topic });
    }

    if (params?.search && params.search.trim()) {
      query.andWhere(
        '(LOWER(practiceSet.title) LIKE :term OR LOWER(practiceSet.topic) LIKE :term)',
        {
          term: `%${params.search.trim().toLowerCase()}%`,
        },
      );
    }

    query.orderBy('practiceSet.id', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    const formattedData = data.map((set) => {
      const questionsCount = set.practiceSetQuestions?.length || 0;
      return {
        ...set,
        totalQuestions: questionsCount,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSummary(skill?: QuestionSkillEnum) {
    const query = this.practiceSetRepository.createQueryBuilder('practiceSet');
    if (skill) {
      query.andWhere('practiceSet.skill = :skill', { skill });
    }

    const sets = await query.getMany();
    const totalSets = sets.length;

    const byHsk: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
    };
    const byTopic: Record<string, number> = Object.create(null);

    sets.forEach((s) => {
      if (s.hskLevel) byHsk[s.hskLevel] = (byHsk[s.hskLevel] || 0) + 1;
      if (s.topic) byTopic[s.topic] = (byTopic[s.topic] || 0) + 1;
    });

    // Count total questions across sets
    const totalQuestionsCount = await this.practiceSetQuestionRepository.count({
      where: skill ? { practiceSet: { skill } } : {},
    });

    return {
      totalSets,
      totalQuestions: totalQuestionsCount,
      byHsk,
      byTopic,
    };
  }

  async getTopicsList(filterHskLevel?: number) {
    // 1. Get stats from DB for practice sets
    const allSets = await this.practiceSetRepository.find({
      relations: ['practiceSetQuestions'],
    });

    const topicStats: Record<
      string,
      {
        totalSets: number;
        totalQuestions: number;
        listeningCount: number;
        speakingCount: number;
        readingCount: number;
        writingCount: number;
        hskLevels: Set<number>;
      }
    > = Object.create(null);

    allSets.forEach((s) => {
      const key = s.topic || 'Chung';
      if (!topicStats[key]) {
        topicStats[key] = {
          totalSets: 0,
          totalQuestions: 0,
          listeningCount: 0,
          speakingCount: 0,
          readingCount: 0,
          writingCount: 0,
          hskLevels: new Set<number>(),
        };
      }
      topicStats[key].totalSets += 1;
      topicStats[key].totalQuestions += s.practiceSetQuestions?.length || 0;
      if (s.hskLevel) topicStats[key].hskLevels.add(s.hskLevel);

      if (s.skill === QuestionSkillEnum.LISTENING)
        topicStats[key].listeningCount += 1;
      else if (s.skill === QuestionSkillEnum.SPEAKING)
        topicStats[key].speakingCount += 1;
      else if (s.skill === QuestionSkillEnum.READING)
        topicStats[key].readingCount += 1;
      else if (s.skill === QuestionSkillEnum.WRITING)
        topicStats[key].writingCount += 1;
    });

    // 2. Get vocabulary count per topic from DB
    const vocabCounts = await this.vocabRepository
      .createQueryBuilder('v')
      .select('v.topic', 'topic')
      .addSelect('COUNT(*)', 'cnt')
      .where('v.topic IS NOT NULL')
      .groupBy('v.topic')
      .getRawMany();

    const vocabMap: Record<string, number> = Object.create(null);
    vocabCounts.forEach((r) => {
      if (r.topic) vocabMap[r.topic] = parseInt(r.cnt, 10);
    });

    // Merge with standard topics catalogue
    let combinedTopics = STANDARD_TOPICS.map((std) => {
      const stats = topicStats[std.topic] || {
        totalSets: 0,
        totalQuestions: 0,
        listeningCount: 0,
        speakingCount: 0,
        readingCount: 0,
        writingCount: 0,
        hskLevels: new Set<number>([std.hskLevel]),
      };

      return {
        id: std.topic,
        topicKey: std.topic,
        titleVi: std.titleVi,
        titleCn: std.titleCn,
        pinyin: std.pinyin,
        icon: std.icon,
        hskLevel: std.hskLevel,
        vocabularyCount: vocabMap[std.topic] || 0,
        totalSets: stats.totalSets,
        totalQuestions: stats.totalQuestions,
        listeningCount: stats.listeningCount,
        speakingCount: stats.speakingCount,
        readingCount: stats.readingCount,
        writingCount: stats.writingCount,
      };
    });

    // Also include any custom topics in DB not in preset
    for (const [key, stats] of Object.entries(topicStats)) {
      if (!STANDARD_TOPICS.some((std) => std.topic === key)) {
        combinedTopics.push({
          id: key,
          topicKey: key,
          titleVi: key,
          titleCn: key,
          pinyin: '',
          icon: '📁',
          hskLevel: Array.from(stats.hskLevels)[0] || 1,
          vocabularyCount: vocabMap[key] || 0,
          totalSets: stats.totalSets,
          totalQuestions: stats.totalQuestions,
          listeningCount: stats.listeningCount,
          speakingCount: stats.speakingCount,
          readingCount: stats.readingCount,
          writingCount: stats.writingCount,
        });
      }
    }

    // Include custom vocabulary topics if any not in preset and not in practice sets
    for (const [key, count] of Object.entries(vocabMap)) {
      if (!combinedTopics.some((t) => t.topicKey === key)) {
        combinedTopics.push({
          id: key,
          topicKey: key,
          titleVi: key,
          titleCn: key,
          pinyin: '',
          icon: '📚',
          hskLevel: 1,
          vocabularyCount: count,
          totalSets: 0,
          totalQuestions: 0,
          listeningCount: 0,
          speakingCount: 0,
          readingCount: 0,
          writingCount: 0,
        });
      }
    }

    if (filterHskLevel) {
      combinedTopics = combinedTopics.filter(
        (t) => t.hskLevel === Number(filterHskLevel),
      );
    }

    return combinedTopics;
  }

  async findAll(filter: {
    skill?: QuestionSkillEnum;
    hskLevel?: number;
    topic?: string;
  }): Promise<PracticeSetEntity[]> {
    const query = this.practiceSetRepository.createQueryBuilder('practiceSet');

    if (filter.skill) {
      query.andWhere('practiceSet.skill = :skill', { skill: filter.skill });
    }
    if (filter.hskLevel) {
      query.andWhere('practiceSet.hskLevel = :hskLevel', {
        hskLevel: filter.hskLevel,
      });
    }
    if (filter.topic) {
      query.andWhere('practiceSet.topic = :topic', { topic: filter.topic });
    }

    return query.getMany();
  }

  async getDetails(id: number): Promise<PracticeSetEntity> {
    const practiceSet = await this.practiceSetRepository.findOne({
      where: { id },
      relations: ['practiceSetQuestions', 'practiceSetQuestions.question'],
    });

    if (!practiceSet) {
      throw new NotFoundException(`Practice Set with ID ${id} not found`);
    }

    // Sort questions by order
    if (practiceSet.practiceSetQuestions) {
      practiceSet.practiceSetQuestions.sort((a, b) => a.order - b.order);
    }

    return practiceSet;
  }
}
