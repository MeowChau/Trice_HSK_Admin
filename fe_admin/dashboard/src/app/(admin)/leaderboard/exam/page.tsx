import type { Metadata } from "next";
import React from "react";
import Link from "next/link";
import { DocsIcon, ShootingStarIcon } from "@/icons";

export const metadata: Metadata = {
  title: "Bảng xếp hạng Đề thi | TRICE HSK Admin",
  description: "Bảng xếp hạng điểm số và tốc độ làm đề thi HSK",
};

export default function ExamLeaderboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Bảng xếp hạng Đề thi
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Xếp hạng thành tích điểm số và thời gian hoàn thành các bài thi thử / đề thi chính thức theo cấp độ HSK 1 - 9
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
          <DocsIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
          Tính năng Bảng xếp hạng Đề thi đang hoàn thiện
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Hệ thống đang tích hợp bảng ghi nhận bài thi học viên để tự động tổng hợp điểm cao nhất và thời gian nộp bài nhanh nhất.
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
