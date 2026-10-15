import { BadRequestException } from '@nestjs/common';
import {
  QuestionSkillEnum,
  QuestionTypeEnum,
} from './infrastructure/persistence/relational/entities/question.enum';

type AuthoredQuestion = {
  type?: QuestionTypeEnum;
  skill?: QuestionSkillEnum;
  payload?: Record<string, unknown>;
  correctAnswer?: Record<string, unknown> | null;
};
const templateKinds: Record<string, [QuestionSkillEnum, QuestionTypeEnum]> = {
  'listen-image-choice': [
    QuestionSkillEnum.LISTENING,
    QuestionTypeEnum.MULTIPLE_CHOICE,
  ],
  'listen-text-choice': [
    QuestionSkillEnum.LISTENING,
    QuestionTypeEnum.MULTIPLE_CHOICE,
  ],
  'listen-image-matching': [
    QuestionSkillEnum.LISTENING,
    QuestionTypeEnum.MATCHING,
  ],
  'listen-true-false': [
    QuestionSkillEnum.LISTENING,
    QuestionTypeEnum.TRUE_FALSE,
  ],
  'listen-dictation': [
    QuestionSkillEnum.LISTENING,
    QuestionTypeEnum.SHORT_ANSWER,
  ],
  'listen-repeat': [QuestionSkillEnum.LISTENING, QuestionTypeEnum.SHORT_ANSWER],
  'read-image-matching': [QuestionSkillEnum.READING, QuestionTypeEnum.MATCHING],
  'read-sentence-matching': [
    QuestionSkillEnum.READING,
    QuestionTypeEnum.MATCHING,
  ],
  'read-word-bank': [QuestionSkillEnum.READING, QuestionTypeEnum.FILL_IN_BLANK],
  'read-text-choice': [
    QuestionSkillEnum.READING,
    QuestionTypeEnum.MULTIPLE_CHOICE,
  ],
  'read-true-false': [QuestionSkillEnum.READING, QuestionTypeEnum.TRUE_FALSE],
  'read-fill-blank': [
    QuestionSkillEnum.READING,
    QuestionTypeEnum.FILL_IN_BLANK,
  ],
  'read-guided-practice': [
    QuestionSkillEnum.READING,
    QuestionTypeEnum.SHORT_ANSWER,
  ],
  'write-tracing': [QuestionSkillEnum.WRITING, QuestionTypeEnum.SHORT_ANSWER],
  'write-short-answer': [
    QuestionSkillEnum.WRITING,
    QuestionTypeEnum.SHORT_ANSWER,
  ],
  'write-essay': [QuestionSkillEnum.WRITING, QuestionTypeEnum.ESSAY],
  'read-aloud': [QuestionSkillEnum.SPEAKING, QuestionTypeEnum.SHORT_ANSWER],
};
function invalid(message: string): never {
  throw new BadRequestException({ status: 400, errors: { question: message } });
}
function media(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.length <= 2048 &&
    (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value))
  );
}
export function validateAuthoredQuestion(question: AuthoredQuestion): void {
  const payload = question.payload;
  // Existing question records remain editable; newly authored templates use v1.
  if (payload?.schemaVersion !== 1) return;
  if (JSON.stringify(payload).length > 64000)
    invalid('Nội dung câu hỏi quá lớn.');
  const template =
    typeof payload.templateId === 'string'
      ? templateKinds[payload.templateId]
      : undefined;
  if (
    !template ||
    template[0] !== question.skill ||
    template[1] !== question.type
  )
    invalid('Khung câu hỏi không khớp kỹ năng hoặc loại câu hỏi.');
  if (typeof payload.text !== 'string' || !payload.text.trim())
    invalid('Cần nội dung hoặc hướng dẫn cho câu hỏi.');
  for (const key of [
    'imageUrl',
    'contextImageUrl',
    'continuationImageUrl',
    'audioUrl',
  ]) {
    if (
      payload[key] !== undefined &&
      payload[key] !== '' &&
      !media(payload[key])
    )
      invalid('Đường dẫn ảnh hoặc audio không hợp lệ.');
  }
  for (const key of ['reviewRequired', 'manualGrading']) {
    if (payload[key] !== undefined && typeof payload[key] !== 'boolean')
      invalid('Trạng thái biên soạn không hợp lệ.');
  }
  const options = payload.options;
  const images = payload.optionImages;
  const choiceType =
    [
      QuestionTypeEnum.MULTIPLE_CHOICE,
      QuestionTypeEnum.MATCHING,
      QuestionTypeEnum.TRUE_FALSE,
    ].includes(question.type as QuestionTypeEnum) ||
    (question.type === QuestionTypeEnum.FILL_IN_BLANK &&
      Array.isArray(options) &&
      options.length > 0);
  if (choiceType) {
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      options.length > 6 ||
      options.some((value) => typeof value !== 'string' || value.length > 4000)
    )
      invalid('Cần từ 2 đến 6 phương án hợp lệ.');
    if (question.type === QuestionTypeEnum.TRUE_FALSE && options.length !== 2)
      invalid('Dạng đúng/sai cần đúng hai phương án.');
    if (
      images !== undefined &&
      (!Array.isArray(images) ||
        (images.length !== 0 && images.length !== options.length) ||
        images.some((value) => value !== '' && !media(value)))
    )
      invalid('Ảnh phương án không khớp danh sách phương án.');
    const optionImages = Array.isArray(images) ? images : [];
    if (
      options.some(
        (value, index) => !String(value).trim() && !optionImages[index],
      ) &&
      !payload.imageUrl &&
      !payload.contextImageUrl
    )
      invalid('Phương án trống cần ảnh đề hoặc ảnh phương án.');
    const answer = question.correctAnswer?.answer;
    if (
      answer !== undefined &&
      answer !== '' &&
      (typeof answer !== 'string' ||
        !options.some((_, index) => String.fromCharCode(65 + index) === answer))
    )
      invalid('Đáp án không thuộc các phương án của câu hỏi.');
    if (payload.manualGrading === true || question.correctAnswer?.rubric)
      invalid('Dạng lựa chọn cần đáp án, không dùng tiêu chí chấm tự luận.');
  }
  const stamp = payload.audioTimestamp;
  if (stamp !== undefined && stamp !== null) {
    if (typeof stamp !== 'object' || Array.isArray(stamp) || !payload.audioUrl)
      invalid('Cần audio trước khi chọn đoạn nghe.');
    const { start = 0, end } = stamp as { start?: unknown; end?: unknown };
    if (
      typeof start !== 'number' ||
      !Number.isFinite(start) ||
      start < 0 ||
      (end !== undefined &&
        (typeof end !== 'number' || !Number.isFinite(end) || end <= start))
    )
      invalid('Thời gian bắt đầu/kết thúc audio không hợp lệ.');
  }
  for (const key of ['answer', 'rubric', 'explanation']) {
    const value = question.correctAnswer?.[key];
    if (
      value !== undefined &&
      (typeof value !== 'string' || value.length > 8000)
    )
      invalid('Đáp án hoặc hướng dẫn chấm không hợp lệ.');
  }
}

export function questionPreparation(question: AuthoredQuestion): string[] {
  const issues: string[] = [];
  if (
    question.skill === QuestionSkillEnum.LISTENING &&
    !question.payload?.audioUrl
  )
    issues.push('needs_audio');
  if (!question.correctAnswer?.answer && !question.correctAnswer?.rubric)
    issues.push('needs_answer');
  if (question.payload?.reviewRequired === true) issues.push('needs_review');
  return issues;
}
