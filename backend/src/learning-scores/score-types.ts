export type LearningSkill = 'Listening' | 'Reading' | 'Writing' | 'Speaking';
export const SKILLS: LearningSkill[] = [
  'Listening',
  'Reading',
  'Writing',
  'Speaking',
];
export interface SourceQuestion {
  id: number;
  skill: string;
  type: string;
  hskLevel: number;
  payload: Record<string, unknown>;
  correctAnswer: Record<string, unknown> | null;
}
export interface SourceItem {
  id: number;
  question: SourceQuestion | null;
  audioUrl?: string | null;
}
export interface LearningSource {
  kind: 'exam' | 'set';
  id: number;
  level: number;
  title: string;
  items: SourceItem[];
}
export interface QuestionGrade {
  questionId: string;
  status: 'correct' | 'incorrect' | 'unanswered' | 'ungraded';
  correctAnswers: string[];
}
export interface SectionGrade {
  skill: LearningSkill;
  score: number | null;
  earned: number;
  possible: number;
  correctCount: number;
  gradedCount: number;
  totalQuestions: number;
  complete: boolean;
}
export interface LearningGrade {
  score: number | null;
  correctCount: number;
  gradedCount: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  ungradedCount: number;
  questions: QuestionGrade[];
  sections: SectionGrade[];
  totalScore: number | null;
  maxScore: number;
  passScore: number | null;
  eligible: boolean;
  passed: boolean;
  reasons: string[];
}
export interface ScoreSample {
  key: string;
  skill: LearningSkill;
  level: number;
  earned: number;
  possible: number;
  questionCount: number;
  at: string;
  taskKind?: 'word' | 'sentence' | 'passage';
}
export interface TracingSample {
  key: string;
  level: number;
  completed: number;
  total: number;
  correctStrokes: number;
  totalStrokes: number;
  mistakes: number;
  at: string;
}
export interface LevelEvidence {
  level: number;
  score: number;
  maxScore: number;
  at: string;
}
export interface SavedScore extends LearningGrade {
  currentHskLevel: number | null;
  previousCurrentHskLevel: number | null;
  sourceVersion: string;
  hskLevel: number;
  estimatedHskLevel: number | null;
  previousHskLevel: number | null;
}
export interface AssessmentProgress {
  version: 1;
  estimatedHskLevel: number | null;
  evidence: LevelEvidence | null;
  samples: ScoreSample[];
  tracing: TracingSample[];
  receipts: Record<string, { hash: string; result: SavedScore }>;
}
export interface SkillAverage {
  score: number | null;
  sampleCount: number;
  questionCount: number;
  updatedAt: string | null;
  taskKind?: 'word' | 'sentence' | 'passage';
}
export interface LearningScoreSummary {
  currentHskLevel: number | null;
  estimatedHskLevel: number | null;
  evidence: LevelEvidence | null;
  hskLevel: number;
  skills: Record<LearningSkill, SkillAverage>;
  writingProgress: {
    completed: number;
    total: number;
    correctStrokes: number;
    totalStrokes: number;
    mistakes: number;
  };
}
export function emptyProgress(): AssessmentProgress {
  return {
    version: 1,
    estimatedHskLevel: null,
    evidence: null,
    samples: [],
    tracing: [],
    receipts: {},
  };
}
