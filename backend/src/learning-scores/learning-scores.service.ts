import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';
import { ExamEntity } from '../exams/infrastructure/persistence/relational/entities/exam.entity';
import { PracticeSetEntity } from '../practice-sets/infrastructure/persistence/relational/entities/practice-set.entity';
import { QuestionEntity } from '../questions/infrastructure/persistence/relational/entities/question.entity';
import type { PronunciationAssessment } from '../ai-proxy/azure-pronunciation';
import { SubmitLearningScoreDto } from './learning-score.dto';
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
      (cause as { driverError?: { code?: string } })?.driverError?.code ===
      '42703'
    )
      throw new ServiceUnavailableException(
        'Cần cập nhật database để lưu điểm và mức HSK. Điểm tạm thời vẫn được giữ trên trang.',
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
        const result: SavedScore = {
          ...grade,
          hskLevel: source.level,
          currentHskLevel,
          previousCurrentHskLevel: user.currentHskLevel,
          previousHskLevel: before,
          estimatedHskLevel: state.estimatedHskLevel,
          sourceVersion: createHash('sha256')
            .update(JSON.stringify(source))
            .digest('hex'),
        };
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
  ) {
    try {
      await this.db.transaction(async (manager) => {
        const user = await this.user(manager, userId, true),
          state = stateOf(user.assessmentProgress);
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
