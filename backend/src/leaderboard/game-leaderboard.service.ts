import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { studyDate } from '../utils/study-date';
import { GameLeaderboardQueryDto } from './game-leaderboard.dto';

export interface GameLeaderboardItem {
  rank: number;
  id: number;
  fullName: string;
  email: string | null;
  studentCode: number | null;
  currentHskLevel: number | null;
  photo: { path: string } | null;
  totalMatches: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  currentWinStreak: number;
  longestWinStreak: number;
  totalExp: number;
  lastPlayedAt: string;
}
export interface GameLeaderboardResult {
  summary: {
    totalPlayers: number;
    totalMatches: number;
    totalDraws: number;
    totalExp: number;
  };
  leaderboard: GameLeaderboardItem[];
  total: number;
}

@Injectable()
export class GameLeaderboardService {
  constructor(private readonly db: DataSource) {}

  async getLeaderboard(params: GameLeaderboardQueryDto = {}) {
    const page = Math.max(1, Math.min(1000000, Math.trunc(params.page || 1)));
    const limit = Math.max(1, Math.min(100, Math.trunc(params.limit || 20)));
    const timeframe = params.timeframe || 'all';
    const metric = params.metric || 'score';
    const now = new Date();
    const fromDate =
      timeframe === 'month'
        ? studyDate(now).slice(0, 7) + '-01'
        : timeframe === 'week'
          ? studyDate(new Date(now.getTime() - 6 * 86400000))
          : null;
    // Only these server-owned expressions can enter ORDER BY; input stays in parameters.
    const order =
      metric === 'wins'
        ? 'wins DESC, "totalScore" DESC, "winRate" DESC, id ASC'
        : metric === 'winRate'
          ? '"winRate" DESC, "totalMatches" DESC, wins DESC, "totalScore" DESC, id ASC'
          : '"totalScore" DESC, wins DESC, "winRate" DESC, id ASC';
    const sql = `
      WITH scope AS (
        SELECT g.id, g."userIds", g."completedAt", g.state->'result' AS result
        FROM game_session g
        WHERE g.status = 'finished' AND jsonb_typeof(g.state->'result') = 'object'
          AND cardinality(g."userIds") = 2 AND g."userIds"[1] <> g."userIds"[2]
          AND ($1::int IS NULL OR g."hskLevel" = $1)
          AND ($2::timestamptz IS NULL OR g."completedAt" >= $2)
          AND g."completedAt" <= $3::timestamptz
      ), events AS (
        SELECT s.id AS "matchId", p."userId", s."completedAt",
          CASE WHEN s.result->>'winnerId' IS NULL THEN 'draw'
            WHEN s.result->>'winnerId' = p."userId"::text THEN 'win' ELSE 'loss' END AS outcome,
          COALESCE(points.score, 0) AS score,
          COALESCE(points.correct, 0) AS correct,
          COALESCE(points.questions, 0) AS questions,
          COALESCE(reward.exp, 0) AS exp
        FROM scope s CROSS JOIN LATERAL unnest(s."userIds") AS p("userId")
        LEFT JOIN LATERAL (
          SELECT
            CASE WHEN jsonb_typeof(x->'score') = 'number' THEN GREATEST((x->>'score')::numeric, 0) ELSE 0 END AS score,
            CASE WHEN jsonb_typeof(x->'correctCount') = 'number' THEN GREATEST((x->>'correctCount')::numeric, 0) ELSE 0 END AS correct,
            CASE WHEN jsonb_typeof(x->'totalQuestions') = 'number' THEN GREATEST((x->>'totalQuestions')::numeric, 0) ELSE 0 END AS questions
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.result->'scores') = 'array' THEN s.result->'scores' ELSE '[]'::jsonb END) x
          WHERE x->>'userId' = p."userId"::text LIMIT 1
        ) points ON true
        LEFT JOIN LATERAL (
          SELECT SUM(CASE WHEN jsonb_typeof(x->'expAwarded') = 'number' THEN GREATEST((x->>'expAwarded')::numeric, 0) ELSE 0 END) AS exp
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.result->'rewards') = 'array' THEN s.result->'rewards' ELSE '[]'::jsonb END) x
          WHERE x->>'userId' = p."userId"::text
        ) reward ON true
      ), sequenced AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "completedAt" DESC, "matchId" DESC) AS recent_order,
          COUNT(*) FILTER (WHERE outcome <> 'win') OVER (
            PARTITION BY "userId" ORDER BY "completedAt", "matchId" ROWS UNBOUNDED PRECEDING
          ) AS run_group
        FROM events
      ), runs AS (
        SELECT "userId", run_group, COUNT(*) FILTER (WHERE outcome = 'win') AS length
        FROM sequenced GROUP BY "userId", run_group
      ), aggregates AS (
        SELECT e."userId", COUNT(*) AS "totalMatches",
          COUNT(*) FILTER (WHERE outcome = 'win') AS wins,
          COUNT(*) FILTER (WHERE outcome = 'draw') AS draws,
          COUNT(*) FILTER (WHERE outcome = 'loss') AS losses,
          100.0 * COUNT(*) FILTER (WHERE outcome = 'win') / COUNT(*) AS "winRate",
          SUM(score) AS "totalScore", SUM(correct) AS "correctCount", SUM(questions) AS "totalQuestions",
          COALESCE(MIN(recent_order) FILTER (WHERE outcome <> 'win') - 1, COUNT(*)) AS "currentWinStreak",
          (SELECT MAX(length) FROM runs r WHERE r."userId" = e."userId") AS "longestWinStreak",
          SUM(exp) AS "totalExp", MAX("completedAt") AS "lastPlayedAt"
        FROM sequenced e GROUP BY e."userId"
      ), profiles AS (
        SELECT u.id, COALESCE(NULLIF(TRIM(u."fullName"), ''), NULLIF(TRIM(CONCAT_WS(' ', u."lastName", u."firstName")), ''), NULLIF(u.username, ''), 'Người chơi #' || u.id::text) AS "fullName",
          u.email, u.username, u."studentCode", u."currentHskLevel",
          CASE WHEN f.path IS NOT NULL THEN jsonb_build_object('path', f.path) ELSE NULL END AS photo,
          a."totalMatches", a.wins, a.draws, a.losses, a."winRate", a."totalScore", a."correctCount", a."totalQuestions",
          a."currentWinStreak", a."longestWinStreak", a."totalExp", a."lastPlayedAt"
        FROM aggregates a JOIN "user" u ON u.id = a."userId" AND u."deletedAt" IS NULL
        LEFT JOIN file f ON f.id = u."photoId"
      ), ranked AS (
        SELECT ROW_NUMBER() OVER (ORDER BY ${order}) AS rank, * FROM profiles
      ), searched AS (
        SELECT * FROM ranked WHERE $4::text IS NULL
          OR strpos(lower("fullName"), lower($4::text)) > 0
          OR strpos(lower(COALESCE(email, '')), lower($4::text)) > 0
          OR strpos(lower(COALESCE(username, '')), lower($4::text)) > 0
          OR strpos(COALESCE("studentCode"::text, ''), $4::text) > 0
      )
      SELECT jsonb_build_object(
        'totalPlayers', (SELECT COUNT(*) FROM profiles),
        'totalMatches', (SELECT COUNT(*) FROM scope),
        'totalDraws', (SELECT COUNT(*) FROM scope WHERE result->>'winnerId' IS NULL),
        'totalExp', COALESCE((SELECT SUM(exp) FROM events), 0)
      ) AS summary,
      (SELECT COUNT(*)::int FROM searched) AS total,
      COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM (
        SELECT rank, id, "fullName", email, "studentCode", "currentHskLevel", photo,
          "totalMatches", wins, draws, losses, "winRate", "totalScore", "correctCount", "totalQuestions",
          "currentWinStreak", "longestWinStreak", "totalExp", "lastPlayedAt"
        FROM searched ORDER BY rank LIMIT $5::int OFFSET $6::int
      ) page), '[]'::jsonb) AS leaderboard
    `;
    const [result] = await this.db.query<GameLeaderboardResult[]>(sql, [
      params.hskLevel || null,
      fromDate ? new Date(fromDate + 'T00:00:00+07:00') : null,
      now,
      params.search?.trim() || null,
      limit,
      (page - 1) * limit,
    ]);
    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
      metric,
      timeframe,
      hskLevel: params.hskLevel || null,
      generatedAt: now.toISOString(),
    };
  }
}
