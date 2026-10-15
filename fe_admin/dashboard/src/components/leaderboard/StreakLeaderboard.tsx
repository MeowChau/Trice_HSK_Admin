"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { errorMessage } from "@/lib/error-message";

import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { apiFetch, API_BASE_URL, readApiError } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
import Badge from "../ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ShootingStarIcon, BoltIcon, TimeIcon, CheckCircleIcon } from "@/icons";

interface StudentStreakItem {
  id: number | string;
  fullName: string;
  email: string;
  studentCode: number | null;
  avatarFrame: string | null;
  level: number;
  currentExp: number;
  targetHskLevel: number | null;
  currentHskLevel: number | null;
  photo: { id: string; path: string } | null;
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  totalHours: number;
  lastStudyDate: string | null;
  streakStatus: "active" | "warning" | "lost";
}

interface StreakLeaderboardData {
  summary: {
    topStreak: number;
    topStreakUser: string | null;
    allTimeRecord: number;
    activeStreaksCount: number;
    totalStudents: number;
    totalStudyHours: number;
  };
  leaderboard: StudentStreakItem[];
}

export default function StreakLeaderboard() {
  const requests = useLatestRequest();
  const [data, setData] = useState<StreakLeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHskLevel, setSelectedHskLevel] = useState<string>(""); // "" = all, "1" -> "9"
  const [selectedTimeframe, setSelectedTimeframe] = useState<
    "all" | "month" | "week"
  >("all");
  const [sortBy, setSortBy] = useState<
    "current_desc" | "longest_desc" | "days_desc" | "hours_desc" | "level_desc"
  >("current_desc");

  const fetchLeaderboard = useCallback(async () => {
    const request = requests.start();
    try {
      setFetchError(null);
      let queryUrl = `leaderboard/streak?timeframe=${selectedTimeframe}`;
      if (selectedHskLevel) {
        queryUrl += `&hskLevel=${selectedHskLevel}`;
      }

      const res = await apiFetch(queryUrl, {
        signal: request.signal,
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (!request.isCurrent()) return;
        setData(json);
      } else {
        const errMsg = await readApiError(res);
        setFetchError(errMsg || `Lỗi HTTP ${res.status}`);
      }
    } catch (err) {
      if (!request.isCurrent()) return;
      console.error("Failed to load streak leaderboard:", err);
      setFetchError(errorMessage(err, "") || "Không thể kết nối đến máy chủ");
    } finally {
      if (request.isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [requests, selectedHskLevel, selectedTimeframe]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLeaderboard();
  };

  const getAvatarUrl = (photo?: { id: string; path: string } | null) => {
    return resolveFileUrl(photo?.path, API_BASE_URL);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa có";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getHskBadge = (level: number | null) => {
    if (!level) {
      return (
        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Chưa đặt
        </span>
      );
    }
    if (level <= 2) {
      return (
        <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
          HSK {level}
        </span>
      );
    }
    if (level <= 4) {
      return (
        <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400">
          HSK {level}
        </span>
      );
    }
    if (level <= 6) {
      return (
        <span className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-400">
          HSK {level}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
        HSK {level} (Cao cấp)
      </span>
    );
  };

  // Filtered & Sorted Leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!data?.leaderboard) return [];

    let list = [...data.leaderboard];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.fullName.toLowerCase().includes(term) ||
          item.email.toLowerCase().includes(term) ||
          (item.studentCode && String(item.studentCode).includes(term)),
      );
    }

    list.sort((a, b) => {
      if (sortBy === "current_desc") {
        if (b.currentStreak !== a.currentStreak)
          return b.currentStreak - a.currentStreak;
        return b.longestStreak - a.longestStreak;
      }
      if (sortBy === "longest_desc") {
        if (b.longestStreak !== a.longestStreak)
          return b.longestStreak - a.longestStreak;
        return b.currentStreak - a.currentStreak;
      }
      if (sortBy === "days_desc") {
        return b.totalDays - a.totalDays;
      }
      if (sortBy === "hours_desc") {
        return b.totalHours - a.totalHours;
      }
      if (sortBy === "level_desc") {
        return b.level - a.level;
      }
      return 0;
    });

    return list;
  }, [data?.leaderboard, searchTerm, sortBy]);

  // Top 3 for podium
  const top1 = filteredLeaderboard[0];
  const top2 = filteredLeaderboard[1];
  const top3 = filteredLeaderboard[2];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <span className="text-xl">🔥</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
                Bảng xếp hạng Chuỗi ngày học
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Vinh danh học viên chuyên cần, duy trì kỷ luật và ngọn lửa học
                tập liên tục mỗi ngày
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
        >
          <svg
            className={`h-4 w-4 ${isRefreshing ? "animate-spin text-brand-500" : "text-gray-500"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? "Đang cập nhật..." : "Làm mới"}
        </button>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          <span>Không thể tải bảng xếp hạng: {fetchError}</span>
          <button
            onClick={handleRefresh}
            className="font-semibold underline hover:no-underline ml-4"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 1. KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Quán quân chuỗi */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 p-5 shadow-sm transition hover:shadow dark:border-amber-900/30 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Quán quân chuỗi ngày
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <span className="text-lg">👑</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-amber-900 dark:text-amber-300">
              {isLoading ? "..." : `${data?.summary?.topStreak || 0}`}
            </span>
            <span className="text-sm font-semibold text-amber-700/80 dark:text-amber-400">
              ngày liên tục
            </span>
          </div>
          <div className="mt-2 text-xs truncate text-gray-600 dark:text-gray-400">
            {data?.summary?.topStreakUser ? (
              <span>
                Đang dẫn đầu:{" "}
                <strong className="text-gray-900 dark:text-white">
                  {data.summary.topStreakUser}
                </strong>
              </span>
            ) : (
              <span>Chưa có học viên nào giữ chuỗi</span>
            )}
          </div>
        </div>

        {/* Card 2: Kỷ lục toàn hệ thống */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Kỷ lục toàn sàn
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
              <ShootingStarIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : `${data?.summary?.allTimeRecord || 0}`}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              ngày kỷ lục
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Kỷ lục chuỗi ngày dài nhất từng đạt được
          </div>
        </div>

        {/* Card 3: Đang duy trì chuỗi */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Đang giữ chuỗi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : data?.summary?.activeStreaksCount || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              học viên
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tỷ lệ:{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {data?.summary?.totalStudents
                ? Math.round(
                    ((data.summary.activeStreaksCount || 0) /
                      data.summary.totalStudents) *
                      100,
                  )
                : 0}
              %
            </span>{" "}
            trên tổng số {data?.summary?.totalStudents || 0} học viên
          </div>
        </div>

        {/* Card 4: Tổng giờ học */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tổng giờ học tích lũy
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <TimeIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : data?.summary?.totalStudyHours || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              giờ
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Tổng thời lượng rèn luyện của toàn bộ học viên
          </div>
        </div>
      </div>

      {/* 2. TOP 3 PODIUM (BỤC VINH DANH) */}
      {filteredLeaderboard.length >= 3 && (
        <div className="rounded-3xl border border-gray-200 bg-gradient-to-b from-gray-50/80 via-white to-white p-6 shadow-sm dark:border-gray-800 dark:from-gray-900/40 dark:via-gray-900/20 dark:to-transparent">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/70 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              🏆 BỤC VINH DANH QUÁN QUÂN
            </span>
            <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
              Top 3 Kỷ luật & Chuyên cần nhất
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto pt-4 pb-2">
            {/* HẠNG 2: SILVER */}
            {top2 && (
              <div className="order-2 md:order-1 flex flex-col items-center text-center rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md dark:border-slate-700/60 dark:bg-gray-850">
                <div className="relative mb-3">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-slate-300 shadow-md dark:border-slate-600">
                    {getAvatarUrl(top2.photo) ? (
                      <Image
                        src={getAvatarUrl(top2.photo)!}
                        alt={top2.fullName}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-700">
                        {top2.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-800 font-extrabold text-sm shadow-md border-2 border-white dark:border-gray-850">
                    🥈 2
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 dark:text-white text-base truncate max-w-[180px]">
                  {top2.fullName}
                </h3>
                <span className="text-xs text-gray-400">
                  {top2.studentCode ? `MSV: #${top2.studentCode}` : top2.email}
                </span>

                <div className="mt-2">{getHskBadge(top2.targetHskLevel)}</div>

                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                  <span>🔥</span>
                  <span>{top2.currentStreak} ngày</span>
                </div>

                <div className="mt-2 text-[11px] text-gray-400">
                  Kỷ lục: {top2.longestStreak} ngày | Lv.{top2.level}
                </div>
              </div>
            )}

            {/* HẠNG 1: GOLD (Nổi bật nhất) */}
            {top1 && (
              <div className="order-1 md:order-2 flex flex-col items-center text-center rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-50/70 via-white to-amber-50/20 p-6 shadow-lg backdrop-blur transition hover:-translate-y-1 hover:shadow-xl dark:border-amber-500/60 dark:from-amber-950/20 dark:via-gray-850 dark:to-gray-850 relative -mt-4">
                <span className="text-3xl absolute -top-5">👑</span>

                <div className="relative mb-3 mt-1">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-amber-400 shadow-xl dark:border-amber-400 ring-4 ring-amber-300/40">
                    {getAvatarUrl(top1.photo) ? (
                      <Image
                        src={getAvatarUrl(top1.photo)!}
                        alt={top1.fullName}
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-tr from-amber-400 to-amber-200 flex items-center justify-center text-2xl font-black text-amber-900">
                        {top1.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-amber-950 font-black text-sm shadow-md border-2 border-white dark:border-gray-850">
                    🥇 1
                  </span>
                </div>

                <h3 className="font-extrabold text-gray-900 dark:text-white text-lg truncate max-w-[200px]">
                  {top1.fullName}
                </h3>
                <span className="text-xs font-medium text-amber-800/80 dark:text-amber-300">
                  {top1.studentCode ? `MSV: #${top1.studentCode}` : top1.email}
                </span>

                <div className="mt-2.5">{getHskBadge(top1.targetHskLevel)}</div>

                <div className="mt-3.5 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-base font-extrabold text-white shadow-md">
                  <span>🔥</span>
                  <span>{top1.currentStreak} ngày liên tục</span>
                </div>

                <div className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Kỷ lục: {top1.longestStreak} ngày • {top1.totalDays} ngày học
                  • Lv.{top1.level}
                </div>
              </div>
            )}

            {/* HẠNG 3: BRONZE */}
            {top3 && (
              <div className="order-3 flex flex-col items-center text-center rounded-2xl border border-amber-200/60 bg-white/90 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md dark:border-amber-900/40 dark:bg-gray-850">
                <div className="relative mb-3">
                  <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-amber-600/50 shadow-md dark:border-amber-700/60">
                    {getAvatarUrl(top3.photo) ? (
                      <Image
                        src={getAvatarUrl(top3.photo)!}
                        alt={top3.fullName}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="h-full w-full bg-amber-100 flex items-center justify-center text-xl font-bold text-amber-800">
                        {top3.fullName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-2 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-700 text-white font-extrabold text-sm shadow-md border-2 border-white dark:border-gray-850">
                    🥉 3
                  </span>
                </div>

                <h3 className="font-bold text-gray-900 dark:text-white text-base truncate max-w-[180px]">
                  {top3.fullName}
                </h3>
                <span className="text-xs text-gray-400">
                  {top3.studentCode ? `MSV: #${top3.studentCode}` : top3.email}
                </span>

                <div className="mt-2">{getHskBadge(top3.targetHskLevel)}</div>

                <div className="mt-3 flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600 dark:bg-orange-950/30 dark:text-orange-400">
                  <span>🔥</span>
                  <span>{top3.currentStreak} ngày</span>
                </div>

                <div className="mt-2 text-[11px] text-gray-400">
                  Kỷ lục: {top3.longestStreak} ngày | Lv.{top3.level}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. BẢNG XẾP HẠNG CHI TIẾT & BỘ LỌC HSK 1 - 9 */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Chi tiết Bảng xếp hạng Chuỗi ngày
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Toàn bộ học viên được tính điểm dựa trên số ngày học liên tục ghi
              nhận từ hệ thống
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, email, MSV..."
                className="w-48 sm:w-56 rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>

            {/* Filter Cấp độ mục tiêu: HSK 1 đến HSK 9 */}
            <select
              value={selectedHskLevel}
              onChange={(e) => setSelectedHskLevel(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 font-medium"
            >
              <option value="">Cấp độ mục tiêu: HSK 1 - 9</option>
              <option value="1">Cấp độ mục tiêu: HSK 1</option>
              <option value="2">Cấp độ mục tiêu: HSK 2</option>
              <option value="3">Cấp độ mục tiêu: HSK 3</option>
              <option value="4">Cấp độ mục tiêu: HSK 4</option>
              <option value="5">Cấp độ mục tiêu: HSK 5</option>
              <option value="6">Cấp độ mục tiêu: HSK 6</option>
              <option value="7">Cấp độ mục tiêu: HSK 7</option>
              <option value="8">Cấp độ mục tiêu: HSK 8</option>
              <option value="9">Cấp độ mục tiêu: HSK 9</option>
            </select>

            {/* Timeframe Filter */}
            <select
              value={selectedTimeframe}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "all" || value === "month" || value === "week")
                  setSelectedTimeframe(value);
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">Toàn thời gian</option>
              <option value="month">Tháng này</option>
              <option value="week">7 ngày qua</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === "current_desc" ||
                  value === "longest_desc" ||
                  value === "days_desc" ||
                  value === "hours_desc" ||
                  value === "level_desc"
                )
                  setSortBy(value);
              }}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="current_desc">Chuỗi hiện tại (Cao ➔ Thấp)</option>
              <option value="longest_desc">Kỷ lục chuỗi (Cao ➔ Thấp)</option>
              <option value="days_desc">Tổng ngày học nhiều nhất</option>
              <option value="hours_desc">Tổng thời lượng học nhiều nhất</option>
              <option value="level_desc">Cấp độ người dùng (Level)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
              <TableRow>
                <TableCell
                  isHeader
                  className="w-16 px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Hạng
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[240px] px-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Học viên
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Mục tiêu HSK
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[110px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Cấp độ
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[150px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Chuỗi hiện tại
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Kỷ lục chuỗi
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[120px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Tổng ngày học
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[120px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Tổng giờ học
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Lần học gần nhất
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Trạng thái
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredLeaderboard.map((student, index) => {
                const avatarSrc = getAvatarUrl(student.photo);
                const initial = student.fullName.charAt(0).toUpperCase();
                const rank = index + 1;
                const hasStreak = student.currentStreak > 0;

                return (
                  <TableRow
                    key={student.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition"
                  >
                    {/* Hạng */}
                    <TableCell className="w-16 px-4 py-3.5 text-center">
                      {hasStreak && rank === 1 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xs shadow-sm">
                          🥇 1
                        </span>
                      ) : hasStreak && rank === 2 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold text-xs shadow-sm">
                          🥈 2
                        </span>
                      ) : hasStreak && rank === 3 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-800 font-bold text-xs border border-amber-300">
                          🥉 3
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          #{rank}
                        </span>
                      )}
                    </TableCell>

                    {/* Học viên: Avatar + Tên + Email + MSV */}
                    <TableCell className="min-w-[240px] px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {avatarSrc ? (
                            <div className="relative w-10 h-10 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
                              <Image
                                src={avatarSrc}
                                alt={student.fullName}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                              {initial}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                              {student.fullName}
                            </span>
                            {student.studentCode && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.2 text-[11px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                #{student.studentCode}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 truncate max-w-[190px]">
                            {student.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Mục tiêu HSK (1-9) */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      {getHskBadge(student.targetHskLevel)}
                    </TableCell>

                    {/* Cấp độ / Level */}
                    <TableCell className="min-w-[110px] px-4 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                        <BoltIcon className="h-3 w-3" />
                        Lv.{student.level}
                      </span>
                    </TableCell>

                    {/* Chuỗi hiện tại */}
                    <TableCell className="min-w-[150px] px-4 py-3.5 text-center">
                      {student.currentStreak > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-1 text-sm font-extrabold text-orange-600 border border-orange-200/60 dark:border-orange-800/40 dark:from-orange-950/30 dark:to-amber-950/30 dark:text-orange-400">
                          <span>🔥</span>
                          <span>{student.currentStreak} ngày</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">
                          0 ngày
                        </span>
                      )}
                    </TableCell>

                    {/* Kỷ lục chuỗi */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      {student.longestStreak > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                          <span>🏆</span>
                          <span>{student.longestStreak} ngày</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">0 ngày</span>
                      )}
                    </TableCell>

                    {/* Tổng ngày học */}
                    <TableCell className="min-w-[120px] px-4 py-3.5 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {student.totalDays} ngày
                    </TableCell>

                    {/* Tổng giờ học */}
                    <TableCell className="min-w-[120px] px-4 py-3.5 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {student.totalHours} giờ
                    </TableCell>

                    {/* Lần học gần nhất */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(student.lastStudyDate)}
                    </TableCell>

                    {/* Trạng thái */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      {student.streakStatus === "active" ? (
                        <Badge size="sm" color="success">
                          Đang duy trì 🔥
                        </Badge>
                      ) : student.streakStatus === "warning" ? (
                        <Badge size="sm" color="warning">
                          Cần học ngay ⚠️
                        </Badge>
                      ) : (
                        <Badge size="sm" color="light">
                          Chưa học ❄️
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredLeaderboard.length === 0 && !isLoading && (
                <TableRow>
                  <td
                    colSpan={10}
                    className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Không tìm thấy học viên nào phù hợp với điều kiện lọc.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
