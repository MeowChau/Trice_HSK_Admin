import { ExamEntity } from './infrastructure/persistence/relational/entities/exam.entity';

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

export function publicExam(exam: ExamEntity) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    hskLevel: exam.hskLevel,
    updatedAt: exam.updatedAt,
    sections: exam.sections.map((section) => ({
      id: section.id,
      title: section.title,
      order: section.order,
      audioUrl: section.audioUrl,
      sectionQuestions: section.sectionQuestions.map((link) => {
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
              }
            : null,
        };
      }),
    })),
  };
}
