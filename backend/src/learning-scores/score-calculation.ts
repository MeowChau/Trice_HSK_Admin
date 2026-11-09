import {
  LearningGrade,
  LearningSkill,
  LearningSource,
  SectionGrade,
  SourceItem,
  SKILLS,
} from './score-types';
const strings = (x: unknown): string[] =>
  Array.isArray(x)
    ? x.flatMap(strings)
    : typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number'
      ? [String(x)]
      : [];
const object = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
export const normalized = (x: string) =>
  x
    .normalize('NFKC')
    .replace(/[\s\u200B-\u200D\uFEFF]+/gu, '')
    .replace(/[。.!！?？，、;；:：]+$/gu, '')
    .toLowerCase();
export const skillName = (value: string): LearningSkill =>
  (value[0] + value.slice(1).toLowerCase()) as LearningSkill;
export function tracingTarget(item: SourceItem): string | null {
  const q = item.question;
  if (!q || q.skill !== 'WRITING') return null;
  const text = String(q.payload.text || '');
  const match =
    /^(?:Luyện viết|Tập viết|Viết chữ|Viết theo mẫu)\s*[:：]\s*(.+)$/iu.exec(
      text,
    );
  if (
    q.payload.templateId !== 'write-tracing' &&
    (!match || q.type === 'ESSAY')
  )
    return null;
  return (match?.[1] || text).match(/\p{Script=Han}/gu)?.join('') || null;
}
export function speechTarget(item: SourceItem): string | null {
  const p = item.question?.payload || {},
    source = object(p.source);
  return (
    [
      p.character,
      p.hanzi,
      source.sourceWord,
      p.sentence,
      p.text,
      p.questionText,
    ].find(
      (x): x is string => typeof x === 'string' && /\p{Script=Han}/u.test(x),
    ) || null
  );
}
function marks(item: SourceItem): number {
  const value = item.question?.payload.marks;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 100
    ? value
    : 1;
}
function one(item: SourceItem, answer: string) {
  const q = item.question,
    p = q?.payload || {},
    key = q?.correctAnswer || {};
  const textAnswer = ['FILL_IN_BLANK', 'SHORT_ANSWER', 'ESSAY'].includes(
    q?.type || '',
  );
  const answers = [
    ...new Set(
      (textAnswer
        ? [...strings(key.answer), ...strings(key.answers)]
        : strings(
            key.optionId ??
              key.correctOptionId ??
              key.id ??
              key.answer ??
              p.correctOptionId,
          )
      )
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  const grade = {
    questionId: String(item.id),
    correctAnswers: answers,
    status: 'ungraded' as 'correct' | 'incorrect' | 'unanswered' | 'ungraded',
  };
  const raw = Array.isArray(p.options) ? p.options : [];
  const images = Array.isArray(p.optionImages) ? p.optionImages : [];
  const options = Array.from(
    { length: Math.max(raw.length, images.length) },
    (_, i) => {
      const option = object(raw[i]),
        fallback = String.fromCharCode(65 + i);
      return {
        id: String(option.id ?? option.optionId ?? option.label ?? fallback),
        text:
          typeof raw[i] === 'string'
            ? String(raw[i])
            : String(option.text ?? option.label ?? option.id ?? fallback),
        image: option.imageUrl || images[i],
      };
    },
  );
  if (q?.type === 'TRUE_FALSE' && !options.length)
    options.push(
      { id: 'A', text: '对', image: undefined },
      { id: 'B', text: '错', image: undefined },
    );
  const separate = q?.skill === 'SPEAKING' || Boolean(tracingTarget(item));
  const unavailable =
    !q ||
    p.reviewRequired === true ||
    p.contentUnavailable === true ||
    p.manualGrading === true ||
    Boolean(key.rubric) ||
    (q.skill === 'LISTENING' && !p.audioUrl && !item.audioUrl) ||
    (['MULTIPLE_CHOICE', 'MATCHING', 'TRUE_FALSE'].includes(q.type) &&
      options.length < 2) ||
    options.some(
      (o) =>
        (!o.text.trim() || o.text.trim() === o.id) &&
        !o.image &&
        !p.imageUrl &&
        !p.contextImageUrl,
    );
  if (separate || unavailable || !answers.length)
    return { grade, earned: null, possible: marks(item), separate };
  if (!answer.trim()) {
    grade.status = 'unanswered';
    return { grade, earned: 0, possible: marks(item), separate };
  }
  const selected = options.find((o) => normalized(o.id) === normalized(answer));
  const values = [answer, ...(selected ? [selected.text] : [])].map(normalized);
  if (q?.type === 'TRUE_FALSE') {
    if (['a', 'true', '1', '对', '是', 'đúng'].includes(normalized(answer)))
      values.push('a', 'true', '1', '对', '是', 'đúng');
    if (['b', 'false', '0', '错', '否', 'sai'].includes(normalized(answer)))
      values.push('b', 'false', '0', '错', '否', 'sai');
  }
  grade.status = answers.some((x) => values.includes(normalized(x)))
    ? 'correct'
    : 'incorrect';
  return {
    grade,
    earned: grade.status === 'correct' ? marks(item) : 0,
    possible: marks(item),
    separate,
  };
}
const EXPECTED: Record<number, Partial<Record<LearningSkill, number>>> = {
  1: { Listening: 20, Reading: 20 },
  2: { Listening: 35, Reading: 25 },
  3: { Listening: 40, Reading: 30, Writing: 10 },
};
export function gradeLearningSource(
  source: LearningSource,
  answers: Record<string, string>,
): LearningGrade {
  const grades = source.items.map((item) =>
    one(item, answers[String(item.id)] || ''),
  );
  const sections: SectionGrade[] = SKILLS.flatMap((skill) => {
    const indexes = source.items.flatMap((item, i) =>
      item.question &&
      skillName(item.question.skill) === skill &&
      !grades[i]!.separate
        ? [i]
        : [],
    );
    if (!indexes.length) return [];
    const usable = indexes.filter((i) => grades[i]!.earned !== null),
      possible = usable.reduce((sum, i) => sum + grades[i]!.possible, 0);
    const earned = usable.reduce((sum, i) => sum + (grades[i]!.earned || 0), 0);
    return [
      {
        skill,
        earned,
        possible,
        score: possible > 0 ? (earned / possible) * 100 : null,
        correctCount: usable.filter(
          (i) => grades[i]!.grade.status === 'correct',
        ).length,
        gradedCount: usable.length,
        totalQuestions: indexes.length,
        complete:
          usable.length === indexes.length &&
          indexes.every(
            (i) => source.items[i]!.question?.hskLevel === source.level,
          ),
      },
    ];
  });
  const reasons: string[] = [],
    expected = EXPECTED[source.level];
  if (source.kind === 'exam') {
    if (
      !expected ||
      SKILLS.some(
        (skill) =>
          source.items.filter(
            (x) => x.question && skillName(x.question.skill) === skill,
          ).length !== (expected[skill] || 0),
      )
    )
      reasons.push(
        'Cấu trúc đề chưa khớp quy tắc HSK đang hỗ trợ; chưa dùng lượt này nâng mức HSK.',
      );
    if (
      source.items.some(
        (x) => !x.question || x.question.hskLevel !== source.level,
      ) ||
      new Set(source.items.map((x) => x.id)).size !== source.items.length
    )
      reasons.push('Đề có câu thiếu, trùng hoặc khác cấp.');
    if (grades.some((x) => x.earned === null))
      reasons.push(
        'Đề chưa có đủ nội dung hoặc đáp án để chấm tất cả phần bắt buộc.',
      );
    if (source.level === 3) {
      const writing = source.items.filter(
        (x) => x.question?.skill === 'WRITING',
      );
      if (
        writing.filter((x) => marks(x) === 12).length !== 5 ||
        writing.filter((x) => marks(x) === 8).length !== 5
      )
        reasons.push(
          'Phần Viết chưa có trọng số 60/40 theo hướng dẫn tự chấm HSK 3.',
        );
    }
  }
  const complete =
    sections.length > 0 &&
    sections.every((s) => s.complete) &&
    grades.every((x) => x.earned !== null || x.separate);
  const eligible = source.kind === 'exam' && reasons.length === 0 && complete;
  const requiredPartsPresent =
    expected &&
    Object.keys(expected).every((skill) =>
      sections.some((section) => section.skill === skill),
    );
  const totalScore =
    eligible && requiredPartsPresent
      ? sections.reduce((sum, s) => sum + (s.score || 0), 0)
      : null;
  const maxScore = sections.length * 100,
    passScore = eligible ? (source.level === 3 ? 180 : 120) : null;
  const usable = grades.filter((x) => x.earned !== null),
    max = usable.reduce((sum, x) => sum + x.possible, 0);
  return {
    score:
      source.kind === 'exam'
        ? totalScore === null || maxScore === 0
          ? null
          : (totalScore / maxScore) * 100
        : max
          ? (usable.reduce((sum, x) => sum + (x.earned || 0), 0) / max) * 100
          : null,
    correctCount: grades.filter((x) => x.grade.status === 'correct').length,
    gradedCount: usable.length,
    totalQuestions: grades.length,
    answeredCount: source.items.filter((x) =>
      Boolean(answers[String(x.id)]?.trim()),
    ).length,
    unansweredCount: grades.filter((x) => x.grade.status === 'unanswered')
      .length,
    ungradedCount: grades.filter((x) => x.earned === null && !x.separate)
      .length,
    questions: grades.map((x) => x.grade),
    sections,
    totalScore,
    maxScore,
    passScore,
    eligible,
    passed: eligible && totalScore !== null && totalScore >= passScore!,
    reasons,
  };
}
