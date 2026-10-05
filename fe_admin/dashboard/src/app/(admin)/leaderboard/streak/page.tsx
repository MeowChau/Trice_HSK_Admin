import type { Metadata } from "next";
import React from "react";
import StreakLeaderboard from "@/components/leaderboard/StreakLeaderboard";

export const metadata: Metadata = {
  title: "Bảng xếp hạng Chuỗi ngày học | TRICE HSK Admin",
  description: "Bảng xếp hạng học viên chuyên cần theo chuỗi ngày học liên tục và cấp độ mục tiêu HSK 1 đến HSK 9",
};

export default function StreakLeaderboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <StreakLeaderboard />
    </div>
  );
}
