import type { Metadata } from "next";
import GameLeaderboard from "@/components/leaderboard/GameLeaderboard";

export const metadata: Metadata = {
  title: "Bảng xếp hạng Game Online | TRICE HSK Admin",
  description: "Bảng xếp hạng đấu trường đối kháng PvP 1v1 trực tuyến",
};

export default function GameLeaderboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8"><GameLeaderboard /></div>
  );
}
