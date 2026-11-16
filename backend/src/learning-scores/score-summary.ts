import {
  AssessmentProgress,
  LearningScoreSummary,
  LearningSkill,
  ScoreSample,
  SKILLS,
  SkillAverage,
} from './score-types';
export function addScoreSample(state: AssessmentProgress, next: ScoreSample) {
  const group = (item: ScoreSample) =>
    item.level === next.level &&
    item.skill === next.skill &&
    item.taskKind === next.taskKind;
  const candidates = [
    next,
    ...state.samples.filter((item) => item.key !== next.key || !group(item)),
  ];
  const limit = next.skill === 'Speaking' ? 10 : 5;
  const keep = candidates.filter(group).slice(0, limit);
  state.samples = [...keep, ...candidates.filter((item) => !group(item))];
}
export function learningSummary(
  state: AssessmentProgress,
  level: number,
  currentHskLevel: number | null = null,
): LearningScoreSummary {
  const recent = state.samples.filter(
    (item) =>
      item.level === level && Date.parse(item.at) >= Date.now() - 30 * 86400000,
  );
  const skills = Object.fromEntries(
    SKILLS.map((skill) => {
      let samples = recent
        .filter((item) => item.skill === skill)
        .sort((a, b) => b.at.localeCompare(a.at));
      const taskKind = skill === 'Speaking' ? samples[0]?.taskKind : undefined;
      if (taskKind)
        samples = samples.filter((item) => item.taskKind === taskKind);
      const earned = samples.reduce((sum, item) => sum + item.earned, 0);
      const possible = samples.reduce((sum, item) => sum + item.possible, 0);
      const value: SkillAverage = {
        score: possible > 0 ? (earned / possible) * 100 : null,
        sampleCount: samples.length,
        questionCount: samples.reduce(
          (sum, item) => sum + item.questionCount,
          0,
        ),
        updatedAt: samples[0]?.at || null,
        ...(taskKind ? { taskKind } : {}),
      };
      return [skill, value];
    }),
  ) as Record<LearningSkill, SkillAverage>;
  const tracing = state.tracing.filter((item) => item.level === level);
  return {
    currentHskLevel,
    estimatedHskLevel: state.estimatedHskLevel,
    evidence: state.evidence,
    hskLevel: level,
    skills,
    writingProgress: {
      completed: tracing.reduce((sum, item) => sum + item.completed, 0),
      total: tracing.reduce((sum, item) => sum + item.total, 0),
      correctStrokes: tracing.reduce(
        (sum, item) => sum + item.correctStrokes,
        0,
      ),
      totalStrokes: tracing.reduce((sum, item) => sum + item.totalStrokes, 0),
      mistakes: tracing.reduce((sum, item) => sum + item.mistakes, 0),
    },
  };
}
