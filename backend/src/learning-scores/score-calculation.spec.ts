import { gradeLearningSource } from './score-calculation';
import {
  emptyProgress,
  LearningSource,
  SourceItem,
  ScoreSample,
} from './score-types';
import { learningSummary, addScoreSample } from './score-summary';
function exam(level: number): LearningSource {
  const counts =
    level === 1 ? [20, 20, 0] : level === 2 ? [35, 25, 0] : [40, 30, 10];
  let id = 0;
  const items: SourceItem[] = counts.flatMap((count, index) =>
    Array.from({ length: count }, (_, i) => {
      const key = ++id;
      return {
        id: key,
        audioUrl: '/fixture.mp3',
        question: {
          id: key,
          skill: ['LISTENING', 'READING', 'WRITING'][index]!,
          type: 'MULTIPLE_CHOICE',
          hskLevel: level,
          payload: {
            text: 'Choose',
            options: ['Hello', 'Thanks'],
            ...(index === 2 ? { marks: i < 5 ? 12 : 8 } : {}),
          },
          correctAnswer: { optionId: 'A' },
        },
      };
    }),
  );
  return { kind: 'exam', id: level, level, title: 'Fixture', items };
}
it.each([1, 2, 3])(
  'accepts a complete HSK %s exam and its section weights',
  (level) => {
    const source = exam(level),
      answers = Object.fromEntries(
        source.items.map((x) => [String(x.id), 'A']),
      );
    const grade = gradeLearningSource(source, answers);
    expect(grade).toMatchObject({
      score: 100,
      passed: true,
      eligible: true,
      totalScore: level === 3 ? 300 : 200,
      passScore: level === 3 ? 180 : 120,
    });
  },
);
it('should fail a blank exam and refuses promotion from incomplete or duplicate content', () => {
  const source = exam(1);
  expect(gradeLearningSource(source, {})).toMatchObject({
    passed: false,
    score: 0,
  });
  source.items.pop();
  expect(gradeLearningSource(source, {}).eligible).toBe(false);
  const duplicate = exam(1);
  duplicate.items[1] = duplicate.items[0]!;
  expect(gradeLearningSource(duplicate, {}).eligible).toBe(false);
});
it('should does not turn a short practice set into HSK promotion evidence', () => {
  const source = { ...exam(1), kind: 'set' as const };
  expect(gradeLearningSource(source, {}).eligible).toBe(false);
});
it('should compute weighted averages per level and excludes samples older than 30 days', () => {
  const state = emptyProgress();
  const now = new Date().toISOString();
  const sample = (
    key: string,
    earned: number,
    possible: number,
  ): ScoreSample => ({
    key,
    earned,
    possible,
    skill: 'Reading',
    level: 1,
    questionCount: possible,
    at: now,
  });
  addScoreSample(state, sample('a', 1, 2));
  addScoreSample(state, sample('b', 8, 8));
  addScoreSample(state, {
    ...sample('old', 0, 100),
    at: '2000-01-01T00:00:00Z',
  });
  addScoreSample(state, { ...sample('other', 0, 100), level: 2 });
  expect(learningSummary(state, 1, 1).skills.Reading.score).toBe(90);
  addScoreSample(state, sample('a', 2, 2));
  expect(learningSummary(state, 1, 1).skills.Reading.score).toBe(100);
  expect(learningSummary(state, 1).skills.Speaking.score).toBeNull();
});
