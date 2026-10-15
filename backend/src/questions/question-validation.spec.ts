import { BadRequestException } from '@nestjs/common';
import {
  questionPreparation,
  validateAuthoredQuestion,
} from './question-validation';
import {
  QuestionSkillEnum as Skill,
  QuestionTypeEnum as Type,
} from './infrastructure/persistence/relational/entities/question.enum';

const question = () => ({
  type: Type.MULTIPLE_CHOICE,
  skill: Skill.LISTENING,
  payload: {
    schemaVersion: 1,
    templateId: 'listen-image-choice',
    text: 'Listen and choose.',
    imageUrl: '/api/v1/files/worksheet.webp',
    options: ['', '', ''],
    reviewRequired: true,
  },
  correctAnswer: null,
});
describe('Authored question validation', () => {
  it('should allow an explicitly incomplete draft without inventing audio or an answer', () => {
    const draft = question();
    expect(() => validateAuthoredQuestion(draft)).not.toThrow();
    expect(questionPreparation(draft)).toEqual([
      'needs_audio',
      'needs_answer',
      'needs_review',
    ]);
  });
  it('should reject a template that does not match the skill and type', () => {
    expect(() =>
      validateAuthoredQuestion({ ...question(), skill: Skill.READING }),
    ).toThrow(BadRequestException);
  });
  it('should reject unsupported media schemes', () => {
    const draft = question();
    expect(() =>
      validateAuthoredQuestion({
        ...draft,
        payload: { ...draft.payload, imageUrl: 'javascript:alert(1)' },
      }),
    ).toThrow(BadRequestException);
  });
  it('should reject an answer outside the available options', () => {
    expect(() =>
      validateAuthoredQuestion({
        ...question(),
        correctAnswer: { answer: 'D' },
      }),
    ).toThrow(BadRequestException);
  });
  it('should reject negative, reversed and unbound audio timestamps', () => {
    const draft = question();
    for (const audioTimestamp of [
      { start: -1 },
      { start: 10, end: 3 },
      { start: NaN },
    ]) {
      expect(() =>
        validateAuthoredQuestion({
          ...draft,
          payload: {
            ...draft.payload,
            audioUrl: '/api/v1/files/audio.mp3',
            audioTimestamp,
          },
        }),
      ).toThrow(BadRequestException);
    }
    expect(() =>
      validateAuthoredQuestion({
        ...draft,
        payload: { ...draft.payload, audioTimestamp: { start: 1 } },
      }),
    ).toThrow(BadRequestException);
  });
  it('should preserve support for an existing legacy payload', () => {
    expect(() =>
      validateAuthoredQuestion({
        type: Type.MULTIPLE_CHOICE,
        skill: Skill.READING,
        payload: { text: 'Legacy' },
      }),
    ).not.toThrow();
  });
});
