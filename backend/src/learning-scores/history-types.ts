import type { PronunciationAssessment } from '../ai-proxy/azure-pronunciation';
import type { LearningSkill, LearningSource, SavedScore } from './score-types';

export interface SpeechAttemptContext {
  attemptId: string;
  kind: 'exam' | 'set';
  sourceId: number;
}

export interface AttemptWritingProgress {
  completedPositions: number[];
  totalCharacters: number;
  correctStrokes: number;
  totalStrokes: number;
  mistakes: number;
}

export interface LearningAttemptSnapshot {
  version: 1;
  source: LearningSource;
  answers: Record<string, string>;
  writingProgress: Record<string, AttemptWritingProgress>;
  speakingAssessments: Record<string, PronunciationAssessment>;
}

export interface LearningAttemptSummary {
  id: string;
  kind: 'exam' | 'set';
  sourceId: number;
  title: string;
  hskLevel: number;
  skills: LearningSkill[];
  submittedAt: string;
  durationSeconds: number | null;
  accuracyPercent: number | null;
  correctCount: number;
  gradedCount: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  ungradedCount: number;
  totalScore: number | null;
  maxScore: number;
  passScore: number | null;
  eligible: boolean;
  passed: boolean;
  reasons: string[];
  gradingStatus: 'graded' | 'partial' | 'ungraded';
  writingProgress: {
    completed: number;
    total: number;
    correctStrokes: number;
    totalStrokes: number;
    mistakes: number;
  };
  speaking: { score: number | null; gradedCount: number; totalCount: number };
}

export interface LearningAttemptDetail extends LearningAttemptSummary {
  result: SavedScore;
  snapshot: LearningAttemptSnapshot;
}
