import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { PracticeSetEntity } from '../practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import type { PronunciationAssessment } from '../ai-proxy/azure-pronunciation';
import {
  LearningHistoryQueryDto,
  SubmitLearningScoreDto,
} from './learning-score.dto';
import { LearningAttemptEntity } from './infrastructure/persistence/relational/entities/learning-attempt.entity';
import {
  attemptSnapshot,
  historySummary,
  learningSourceVersion,
  sourceSkills,
} from './attempt-history';
import type {
  LearningAttemptDetail,
  SpeechAttemptContext,
} from './history-types';
import {
  AssessmentProgress,
  emptyProgress,
  LearningSource,
  SavedScore,
} from './score-types';
import {
  gradeLearningSource,
  normalized,
  speechTarget,
  tracingTarget,
} from './score-calculation';
import { addScoreSample, learningSummary } from './score-summary';
const record = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const count = (x: unknown) =>
  typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 100000
    ? x
    : 0;
function stateOf(value: AssessmentProgress | null | undefined) {
  return value?.version === 1 &&
    Array.isArray(value.samples) &&
    Array.isArray(value.tracing) &&
    value.receipts
    ? value
    : emptyProgress();
}
@Injectable()
export class LearningScoresService {
  constructor(private readonly db: DataSource) {}
  private storageError(cause: unknown): never {
    if (
      ['42703', '42P01'].includes(
        (cause as { driverError?: { code?: string } })?.driverError?.code || '',
      )
    )
      throw new ServiceUnavailableException(
        'Cần cập nhật database để lưu điểm và lịch sử bài làm. Điểm tạm thời vẫn được giữ trên trang.',
      );
    throw cause;
  }
  private async user(manager: EntityManager, id: number, lock = false) {
    const user = await manager.getRepository(UserEntity).findOne({
      where: { id },
      loadEagerRelations: false,
      select: { id: true, currentHskLevel: true, assessmentProgress: true },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản.');
    return user;
  }
  async summary(userId: number, level?: number) {
    try {
      const user = await this.user(this.db.manager, userId);
      return learningSummary(
        stateOf(user.assessmentProgress),
        level || user.currentHskLevel || 1,
        user.currentHskLevel,
      );
    } catch (cause) {
      this.storageError(cause);
    }
  }
  async history(userId: number, query: LearningHistoryQueryDto = {}) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException(
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
      );
    try {
      const page = Math.max(1, Math.min(1000000, Math.trunc(query.page || 1)));
      const limit = Math.max(1, Math.min(100, Math.trunc(query.limit || 10)));
      const builder = this.db
        .getRepository(LearningAttemptEntity)
        .createQueryBuilder('attempt')
        .select(['attempt.id', 'attempt.summary'])
        .where('attempt.userId = :userId', { userId })
        .andWhere('attempt.status = :status', { status: 'submitted' });
      if (query.kind)
        builder.andWhere('attempt.kind = :kind', { kind: query.kind });
      if (query.sourceId)
        builder.andWhere('attempt.sourceId = :sourceId', {
          sourceId: query.sourceId,
        });
      if (query.hskLevel)
        builder.andWhere('attempt.hskLevel = :hskLevel', {
          hskLevel: query.hskLevel,
        });
      if (query.skill)
        builder.andWhere(':skill = ANY(attempt.skills)', {
          skill: query.skill,
        });
      if (query.search?.trim())
        builder.andWhere('attempt.title ILIKE :search', {
          search: '%' + query.search.trim().replace(/[\\%_]/g, '\\$&') + '%',
        });
      if (query.from)
        builder.andWhere('attempt.submittedAt >= :from', {
          from: new Date(query.from + 'T00:00:00+07:00'),
        });
      if (query.to)
        builder.andWhere('attempt.submittedAt < :until', {
          until: new Date(Date.parse(query.to + 'T00:00:00+07:00') + 86400000),
        });
      const [attempts, total] = await builder
        .orderBy('attempt.submittedAt', 'DESC')
        .addOrderBy('attempt.id', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      return {
        data: attempts.map((attempt) => attempt.summary!),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (cause) {
      this.storageError(cause);
    }
  }

  async historyDetail(
    userId: number,
    id: string,
  ): Promise<LearningAttemptDetail> {
    try {
      const attempt = await this.db
        .getRepository(LearningAttemptEntity)
        .findOne({ where: { id, userId, status: 'submitted' } });
      if (!attempt?.result || !attempt.submittedAt)
        throw new NotFoundException('Không tìm thấy bài làm đã nộp.');
      return {
        ...historySummary(attempt),
        result: attempt.result,
        snapshot: attempt.snapshot,
      };
    } catch (cause) {
      this.storageError(cause);
    }
  }

  private assertAttemptSource(
    attempt: LearningAttemptEntity,
    context: SpeechAttemptContext,
    version?: string,
  ) {
    if (attempt.kind !== context.kind || attempt.sourceId !== context.sourceId)
      throw new ConflictException(
        'Mã lượt làm đã được sử dụng cho bài khác. Hãy bắt đầu lượt mới.',
      );
    if (version && attempt.sourceVersion !== version)
      throw new ConflictException(
        'Nội dung bài đã thay đổi. Hãy tải lại bài để bắt đầu lượt mới.',
      );
  }

  private async speechDraft(
    manager: EntityManager,
    userId: number,
    question: QuestionEntity,
    context: SpeechAttemptContext,
  ) {
    const repository = manager.getRepository(LearningAttemptEntity);
    let attempt = await repository.findOne({
      where: { userId, clientAttemptId: context.attemptId },
    });
    if (attempt?.status === 'submitted')
      throw new ConflictException(
        'Lượt làm này đã được nộp. Hãy bắt đầu lượt mới để ghi âm lại.',
      );
    const source = await this.source(manager, context.kind, context.sourceId);
    if (
      !source.items.some(
        (item) =>
          item.id === question.id && item.question?.skill === 'SPEAKING',
      )
    )
      throw new BadRequestException('Câu luyện nói không thuộc bài đang làm.');
    const version = learningSourceVersion(source);
    if (attempt) this.assertAttemptSource(attempt, context, version);
    else
      attempt = await repository.save(
        repository.create({
          userId,
          clientAttemptId: context.attemptId,
          kind: context.kind,
          sourceId: context.sourceId,
          title: source.title,
          hskLevel: source.level,
          skills: sourceSkills(source),
          status: 'draft',
          sourceVersion: version,
          snapshot: attemptSnapshot(source),
          requestHash: null,
          result: null,
          summary: null,
          pendingSpeechRequests: {},
          durationSeconds: null,
          startedAt: null,
          submittedAt: null,
        }),
      );
    return attempt;
  }

  async prepareSpeechAttempt(
    userId: number,
    question: QuestionEntity,
    context: SpeechAttemptContext,
  ): Promise<string> {
    try {
      return await this.db.transaction(async (manager) => {
        const user = await this.user(manager, userId, true);
        if (stateOf(user.assessmentProgress).receipts[context.attemptId])
          throw new ConflictException(
            'Lượt làm này đã có kết quả. Hãy bắt đầu lượt mới.',
          );
        const attempt = await this.speechDraft(
          manager,
          userId,
          question,
          context,
        );
        const token = randomUUID();
        attempt.pendingSpeechRequests = {
          ...attempt.pendingSpeechRequests,
          [String(question.id)]: token,
        };
        delete attempt.snapshot.speakingAssessments[String(question.id)];
        await manager.getRepository(LearningAttemptEntity).save(attempt);
        return token;
      });
    } catch (cause) {
      this.storageError(cause);
    }
  }
  private async source(
    manager: EntityManager,
    kind: 'exam' | 'set',
    id: number,
  ): Promise<LearningSource> {
    if (kind === 'exam') {
      const exam = await manager.getRepository(ExamEntity).findOne({
        where: { id },
        relations: [
          'sections',
          'sections.sectionQuestions',
          'sections.sectionQuestions.question',
        ],
      });
      if (!exam) throw new NotFoundException('Không tìm thấy đề thi.');
      return {
        kind,
        id,
        level: exam.hskLevel,
        title: exam.title,
        items: [...exam.sections]
          .sort((a, b) => a.order - b.order)
          .flatMap((section) =>
            [...section.sectionQuestions]
              .sort((a, b) => a.order - b.order)
              .map((link) => ({
                id: link.questionId,
                question: link.question,
                audioUrl: section.audioUrl,
              })),
          ),
      };
    }
    const set = await manager.getRepository(PracticeSetEntity).findOne({
      where: { id },
      relations: ['practiceSetQuestions', 'practiceSetQuestions.question'],
    });
    if (!set) throw new NotFoundException('Không tìm thấy bài luyện.');
    return {
      kind,
      id,
      level: set.hskLevel,
      title: set.title,
      items: [...set.practiceSetQuestions]
        .sort((a, b) => a.order - b.order)
        .map((link) => ({
          id: link.questionId,
          question: link.question,
          audioUrl: set.audioUrl,
        })),
    };
  }
  async submit(
    userId: number,
    dto: SubmitLearningScoreDto,
  ): Promise<SavedScore> {
    if (
      JSON.stringify(dto).length > 150000 ||
      Object.entries(dto.answers).some(
        ([id, answer]) =>
          !/^\d{1,10}$/.test(id) ||
          typeof answer !== 'string' ||
          answer.length > 10000,
      )
    )
      throw new BadRequestException('Câu trả lời không hợp lệ.');
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          kind: dto.kind,
          sourceId: dto.sourceId,
          answers: Object.entries(dto.answers).sort(),
          writingProgress: dto.writingProgress || {},
        }),
      )
      .digest('hex');
    try {
      return await this.db.transaction(async (manager) => {
        const user = await this.user(manager, userId, true),
          state = stateOf(user.assessmentProgress);
        const attempts = manager.getRepository(LearningAttemptEntity);
        const previousAttempt = await attempts.findOne({
          where: { userId, clientAttemptId: dto.attemptId },
        });
        if (previousAttempt?.status === 'submitted') {
          if (previousAttempt.requestHash !== hash)
            throw new ConflictException(
              'Lượt này đã có kết quả. Vui lòng bắt đầu lượt mới.',
            );
          return previousAttempt.result!;
        }
        if (previousAttempt) this.assertAttemptSource(previousAttempt, dto);
        const prior = state.receipts[dto.attemptId];
        if (prior) {
          if (prior.hash !== hash)
            throw new ConflictException(
              'Lượt này đã có kết quả. Vui lòng bắt đầu lượt mới.',
            );
          const currentHskLevel = prior.result.passed
            ? Math.max(user.currentHskLevel || 0, prior.result.hskLevel)
            : user.currentHskLevel;
          if (currentHskLevel !== user.currentHskLevel)
            await manager
              .getRepository(UserEntity)
              .update(userId, { currentHskLevel });
          return {
            ...prior.result,
            currentHskLevel,
            previousCurrentHskLevel:
              prior.result.previousCurrentHskLevel !== undefined
                ? prior.result.previousCurrentHskLevel
                : user.currentHskLevel,
          };
        }
        const source = await this.source(manager, dto.kind, dto.sourceId);
        const sourceVersion = learningSourceVersion(source);
        if (previousAttempt)
          this.assertAttemptSource(previousAttempt, dto, sourceVersion);
        if (dto.sourceVersion && dto.sourceVersion !== sourceVersion)
          throw new ConflictException(
            'Nội dung bài đã thay đổi. Hãy tải lại bài để bắt đầu lượt mới.',
          );
        const ids = new Set(source.items.map((item) => String(item.id)));
        if (Object.keys(dto.answers).some((id) => !ids.has(id)))
          throw new BadRequestException(
            'Câu trả lời không thuộc bài đang làm.',
          );
        const grade = gradeLearningSource(source, dto.answers),
          before = state.estimatedHskLevel,
          now = new Date().toISOString();
        const currentHskLevel = grade.passed
          ? Math.max(user.currentHskLevel || 0, source.level)
          : user.currentHskLevel;
        if (grade.passed && source.level > (state.estimatedHskLevel || 0)) {
          state.estimatedHskLevel = source.level;
          state.evidence = {
            level: source.level,
            score: grade.totalScore!,
            maxScore: grade.maxScore,
            at: now,
          };
        }
        for (const section of grade.sections.filter(
          (item) => item.complete && item.possible > 0,
        ))
          addScoreSample(state, {
            key: dto.kind + '-' + dto.sourceId,
            skill: section.skill,
            level: source.level,
            earned: section.earned,
            possible: section.possible,
            questionCount: section.gradedCount,
            at: now,
          });
        for (const item of source.items) {
          const text = tracingTarget(item);
          if (!text) continue;
          const raw = record(dto.writingProgress?.[String(item.id)]),
            total = [...text].length;
          const positions = Array.isArray(raw.completedPositions)
            ? [
                ...new Set(
                  raw.completedPositions.filter(
                    (x) =>
                      Number.isInteger(x) &&
                      Number(x) >= 0 &&
                      Number(x) < total,
                  ),
                ),
              ]
            : [];
          const key = 'character-' + item.id,
            previous = state.tracing.find(
              (x) => x.key === key && x.level === source.level,
            );
          const totalStrokes = count(raw.totalStrokes);
          const sample = {
            key,
            level: source.level,
            completed: Math.max(previous?.completed || 0, positions.length),
            total,
            correctStrokes: Math.min(totalStrokes, count(raw.correctStrokes)),
            totalStrokes,
            mistakes: count(raw.mistakes),
            at: now,
          };
          state.tracing = [
            sample,
            ...state.tracing.filter(
              (x) => x.key !== key || x.level !== source.level,
            ),
          ];
        }
        const historyId = previousAttempt?.id || randomUUID();
        const snapshot = attemptSnapshot(
          source,
          dto.answers,
          dto.writingProgress,
        );
        if (previousAttempt)
          snapshot.speakingAssessments =
            previousAttempt.snapshot.speakingAssessments;
        const result: SavedScore = {
          ...grade,
          hskLevel: source.level,
          currentHskLevel,
          previousCurrentHskLevel: user.currentHskLevel,
          previousHskLevel: before,
          estimatedHskLevel: state.estimatedHskLevel,
          sourceVersion,
          historyId,
          submittedAt: now,
          accuracyPercent: grade.gradedCount
            ? Math.round((grade.correctCount / grade.gradedCount) * 100)
            : null,
        };
        const savedAttempt = attempts.create({
          ...previousAttempt,
          id: historyId,
          userId,
          clientAttemptId: dto.attemptId,
          kind: dto.kind,
          sourceId: dto.sourceId,
          title: source.title,
          hskLevel: source.level,
          skills: sourceSkills(source),
          status: 'submitted',
          requestHash: hash,
          sourceVersion,
          snapshot,
          result,
          submittedAt: new Date(now),
          durationSeconds: dto.durationSeconds ?? null,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
          pendingSpeechRequests: {},
        });
        savedAttempt.summary = historySummary(savedAttempt);
        await attempts.save(savedAttempt);
        state.receipts = Object.fromEntries(
          [
            [dto.attemptId, { hash, result }],
            ...Object.entries(state.receipts),
          ].slice(0, 20),
        );
        await manager
          .getRepository(UserEntity)
          .update(userId, { assessmentProgress: state, currentHskLevel });
        return result;
      });
    } catch (cause) {
      this.storageError(cause);
    }
  }
  async speechQuestion(id: number, referenceText: string) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647)
      throw new BadRequestException('Mã câu luyện nói không hợp lệ.');
    const question = await this.db
      .getRepository(QuestionEntity)
      .findOneBy({ id });
    if (
      !question ||
      question.skill !== 'SPEAKING' ||
      question.hskLevel < 1 ||
      question.hskLevel > 9 ||
      normalized(speechTarget({ id, question }) || '') !==
        normalized(referenceText)
    )
      throw new BadRequestException(
        'Nội dung ghi âm không khớp câu luyện nói.',
      );
    return question;
  }
  async recordPronunciation(
    userId: number,
    question: QuestionEntity,
    assessment: PronunciationAssessment,
    context?: SpeechAttemptContext,
    requestToken?: string,
  ) {
    try {
      await this.db.transaction(async (manager) => {
        const user = await this.user(manager, userId, true),
          state = stateOf(user.assessmentProgress);
        if (context) {
          const attempt = await this.speechDraft(
            manager,
            userId,
            question,
            context,
          );
          if (
            !requestToken ||
            attempt.pendingSpeechRequests[String(question.id)] !== requestToken
          )
            throw new ConflictException(
              'Bản ghi này đã được thay thế bởi lượt ghi âm mới hơn.',
            );
          const pending = { ...attempt.pendingSpeechRequests };
          delete pending[String(question.id)];
          attempt.pendingSpeechRequests = pending;
          attempt.snapshot.speakingAssessments = {
            ...attempt.snapshot.speakingAssessments,
            [String(question.id)]: assessment,
          };
          await manager.getRepository(LearningAttemptEntity).save(attempt);
        }
        const text = speechTarget({ id: question.id, question }) || '',
          length = text.match(/\p{Script=Han}/gu)?.length || 0;
        const taskKind =
          length > 60
            ? 'passage'
            : length <= 6 && !/[。！？!?]/u.test(text)
              ? 'word'
              : 'sentence';
        addScoreSample(state, {
          key: 'speech-' + question.id,
          skill: 'Speaking',
          level: question.hskLevel,
          earned: assessment.score,
          possible: 100,
          questionCount: 1,
          taskKind,
          at: new Date().toISOString(),
        });
        await manager
          .getRepository(UserEntity)
          .update(userId, { assessmentProgress: state });
      });
    } catch (cause) {
      this.storageError(cause);
    }
  }
}
