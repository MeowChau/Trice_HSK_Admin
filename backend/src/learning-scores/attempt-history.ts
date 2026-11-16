import { createHash } from 'crypto';
import type { LearningSource } from './score-types';
import { SKILLS } from './score-types';
import { tracingTarget } from './score-calculation';
import type {
  LearningAttemptSnapshot,
  LearningAttemptSummary,
} from './history-types';
import type { LearningAttemptEntity } from './infrastructure/persistence/relational/entities/learning-attempt.entity';

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const count = (value: unknown) =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0 &&
  value <= 100000
    ? value
    : 0;

export const learningSourceVersion = (source: LearningSource) =>
  createHash('sha256').update(JSON.stringify(source)).digest('hex');
export const sourceSkills = (source: LearningSource) =>
  SKILLS.filter((skill) =>
    source.items.some(
      (item) => item.question?.skill.toUpperCase() === skill.toUpperCase(),
    ),
  );

export function attemptSnapshot(
  source: LearningSource,
  answers: Record<string, string> = {},
  writing: Record<string, unknown> = {},
): LearningAttemptSnapshot {
  const storedSource: LearningSource = {
    ...source,
    items: source.items.map((item) => ({
      id: item.id,
      audioUrl: item.audioUrl || null,
      question: item.question
        ? {
            id: item.question.id,
            skill: item.question.skill,
            type: item.question.type,
            hskLevel: item.question.hskLevel,
            payload: item.question.payload,
            correctAnswer: item.question.correctAnswer,
          }
        : null,
    })),
  };
  const writingProgress = Object.fromEntries(
    source.items.flatMap((item) => {
      const text = tracingTarget(item);
      if (!text) return [];
      const input = object(writing[String(item.id)]);
      const totalCharacters = [...text].length;
      const completedPositions = Array.isArray(input.completedPositions)
        ? [
            ...new Set(
              input.completedPositions.filter(
                (value): value is number =>
                  Number.isInteger(value) &&
                  Number(value) >= 0 &&
                  Number(value) < totalCharacters,
              ),
            ),
          ].sort((a, b) => a - b)
        : [];
      const totalStrokes = count(input.totalStrokes);
      return [
        [
          String(item.id),
          {
            completedPositions,
            totalCharacters,
            totalStrokes,
            correctStrokes: Math.min(totalStrokes, count(input.correctStrokes)),
            mistakes: count(input.mistakes),
          },
        ],
      ];
    }),
  );
  return JSON.parse(
    JSON.stringify({
      version: 1,
      source: storedSource,
      answers: Object.fromEntries(Object.entries(answers).sort()),
      writingProgress,
      speakingAssessments: {},
    }),
  ) as LearningAttemptSnapshot;
}

export function historySummary(
  attempt: LearningAttemptEntity,
): LearningAttemptSummary {
  const result = attempt.result!;
  const writingProgress = Object.values(
    attempt.snapshot.writingProgress,
  ).reduce(
    (sum, item) => ({
      completed: sum.completed + item.completedPositions.length,
      total: sum.total + item.totalCharacters,
      correctStrokes: sum.correctStrokes + item.correctStrokes,
      totalStrokes: sum.totalStrokes + item.totalStrokes,
      mistakes: sum.mistakes + item.mistakes,
    }),
    { completed: 0, total: 0, correctStrokes: 0, totalStrokes: 0, mistakes: 0 },
  );
  const speechIds = attempt.snapshot.source.items
    .filter((item) => item.question?.skill === 'SPEAKING')
    .map((item) => String(item.id));
  const assessments = speechIds.flatMap((id) =>
    attempt.snapshot.speakingAssessments[id]
      ? [attempt.snapshot.speakingAssessments[id]]
      : [],
  );
  const speaking = {
    score: assessments.length
      ? Math.round(
          (assessments.reduce((sum, item) => sum + item.score, 0) /
            assessments.length) *
            10,
        ) / 10
      : null,
    gradedCount: assessments.length,
    totalCount: speechIds.length,
  };
  const evaluatedCount = result.gradedCount + assessments.length;
  return {
    id: attempt.id,
    kind: attempt.kind,
    sourceId: attempt.sourceId,
    title: attempt.title,
    hskLevel: attempt.hskLevel,
    skills: attempt.skills,
    submittedAt: attempt.submittedAt!.toISOString(),
    durationSeconds: attempt.durationSeconds,
    accuracyPercent: result.gradedCount
      ? Math.round((result.correctCount / result.gradedCount) * 100)
      : null,
    correctCount: result.correctCount,
    gradedCount: result.gradedCount,
    totalQuestions: result.totalQuestions,
    answeredCount: result.answeredCount,
    unansweredCount: result.unansweredCount,
    ungradedCount: result.ungradedCount,
    totalScore: result.totalScore,
    maxScore: result.maxScore,
    passScore: result.passScore,
    eligible: result.eligible,
    passed: result.passed,
    reasons: result.reasons,
    gradingStatus: !evaluatedCount
      ? 'ungraded'
      : evaluatedCount < result.totalQuestions
        ? 'partial'
        : 'graded',
    writingProgress,
    speaking,
  };
}
