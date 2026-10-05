import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { ShootingStarIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Bảng xếp hạng Game Online | TRICE HSK Admin",
  description: "Bảng xếp hạng đấu trường đối kháng PvP 1v1 trực tuyến",
};

export default function GameLeaderboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Bảng xếp hạng Game Online (PvP)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Xếp hạng đấu trường so tài 1v1 thời gian thực theo điểm Elo, tỷ lệ thắng và chuỗi thắng
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
          <ShootingStarIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
          Tính năng Bảng xếp hạng Game Online đang hoàn thiện
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Hệ thống đang liên kết các trận so tài trực tiếp qua Socket.io và Redis Matchmaking để tính điểm Rank Elo.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/leaderboard/streak"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
          >
            <span>🔥</span> Xem Bảng xếp hạng Chuỗi ngày
          </Link>
        </div>
      </div>
    </div>
  );
}
