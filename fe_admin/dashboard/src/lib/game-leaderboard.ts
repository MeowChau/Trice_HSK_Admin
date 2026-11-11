export type GameLeaderboardMetric = "score" | "wins" | "winRate";
export type GameLeaderboardTimeframe = "all" | "week" | "month";
export interface GameLeaderboardQuery {
  page: number;
  limit: number;
  hskLevel: string;
  timeframe: GameLeaderboardTimeframe;
  metric: GameLeaderboardMetric;
  search: string;
}
export interface GameLeaderboardPlayer {
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
export interface GameLeaderboardData {
  summary: { totalPlayers: number; totalMatches: number; totalDraws: number; totalExp: number };
  leaderboard: GameLeaderboardPlayer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  generatedAt: string;
}
export const GAME_RANKING_DESCRIPTIONS: Record<GameLeaderboardMetric, string> = {
  score: "Xếp theo tổng điểm PK giảm dần; bằng điểm ưu tiên số trận thắng, sau đó tỷ lệ thắng.",
  wins: "Xếp theo số trận thắng giảm dần; bằng số trận thắng ưu tiên tổng điểm PK, sau đó tỷ lệ thắng.",
  winRate: "Xếp theo tỷ lệ thắng giảm dần; bằng tỷ lệ ưu tiên số trận tham gia, số trận thắng rồi tổng điểm PK.",
};
export function gameLeaderboardPath(query: GameLeaderboardQuery) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit), timeframe: query.timeframe, metric: query.metric });
  if (query.hskLevel) params.set("hskLevel", query.hskLevel);
  if (query.search.trim()) params.set("search", query.search.trim());
  return "leaderboard/game?" + params;
}
export function gameLeaderboardDate(value: string) {
  return Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}
