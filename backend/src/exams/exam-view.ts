import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';
import type { ExamAccess } from './exam-access';

// An explicit allowlist keeps answer keys, transcripts and raw OCR out of the
// public exam contract, including when authors add more payload fields later.
const visibleFields = [
  'schemaVersion',
  'templateId',
  'text',
  'pinyin',
  'translation',
  'imageUrl',
  'contextImageUrl',
  'continuationImageUrl',
  'options',
  'optionImages',
  'audioUrl',
  'audioTimestamp',
  'manualGrading',
];

export function publicExam(
  exam: Pick<
    ExamEntity,
    'id' | 'title' | 'description' | 'hskLevel' | 'updatedAt' | 'sections'
  >,
  includeAnswerKey = false,
  access?: ExamAccess,
) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    hskLevel: exam.hskLevel,
    updatedAt: exam.updatedAt,
    totalQuestions: exam.sections.reduce(
      (sum, section) => sum + section.sectionQuestions.length,
      0,
    ),
    ...(access ? { access } : {}),
    sections: exam.sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      questionCount: section.sectionQuestions.length,
      skill: section.sectionQuestions.find((link) => link.question?.skill)
        ?.question?.skill,
      audioUrl: access && !access.canAttempt ? null : section.audioUrl,
      sectionQuestions:
        access && !access.canAttempt
          ? []
          : section.sectionQuestions.map((link) => {
              const q = link.question;
              return {
                questionId: link.questionId,
                order: link.order,
                question: q
                  ? {
                      id: q.id,
                      type: q.type,
                      skill: q.skill,
                      hskLevel: q.hskLevel,
                      payload: Object.fromEntries(
                        visibleFields
                          .filter((key) => key in q.payload)
                          .map((key) => [key, q.payload[key]]),
                      ),
                      ...(includeAnswerKey
                        ? {
                            correctAnswer: q.correctAnswer
                              ? {
                                  answer: q.correctAnswer.answer,
                                  answers: q.correctAnswer.answers,
                                  optionId: q.correctAnswer.optionId,
                                  id: q.correctAnswer.id,
                                  correctOptionId:
                                    q.correctAnswer.correctOptionId,
                                }
                              : null,
                          }
                        : {}),
                    }
                  : null,
              };
            }),
    })),
  };
}
