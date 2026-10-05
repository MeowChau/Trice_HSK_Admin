"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ApexOptions } from "apexcharts";
import { apiFetch, API_BASE_URL, readApiError } from "@/lib/api";
import Badge from "../ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  GroupIcon,
  CheckCircleIcon,
  DocsIcon,
  ShootingStarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PieChartIcon,
  GridIcon,
} from "@/icons";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface TeacherStatsData {
  overview: {
    totalTeachers: number;
    activeTeachers: number;
    growthPercentage: number;
    totalQuestionsContributed: number;
    totalExamsContributed: number;
  };
  positionDistribution: {
    labels: string[];
    counts: number[];
    percentages: number[];
  };
  productivityTimeline: {
    categories: string[];
    questionsSeries: number[];
    examsSeries: number[];
  };
  skillsAndLevels: {
    skills: {
      labels: string[];
      counts: number[];
    };
    levels: {
      labels: string[];
      counts: number[];
    };
  };
  leaderboard: Array<{
    id: number | string;
    fullName: string;
    email: string;
    position: string;
    status: {
      id: number;
      name: string;
    };
    photo: {
      id: string;
      path: string;
    } | null;
    questionsCount: number;
    examsCount: number;
    lastActive: string;
  }>;
}

export default function TeacherStats() {
  const [stats, setStats] = useState<TeacherStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters for leaderboard
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState<"questions_desc" | "exams_desc" | "name_asc">("questions_desc");

  const fetchStats = async () => {
    try {
      setFetchError(null);
      const res = await apiFetch("analytics/teacher-stats", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const errMsg = await readApiError(res);
        setFetchError(errMsg || `Lỗi HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.error("Failed to load teacher stats:", err);
      setFetchError(err?.message || "Không thể kết nối đến máy chủ");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  const getAvatarUrl = (photo?: { id: string; path: string } | null) => {
    if (!photo?.path) return null;
    let cleanPath = photo.path.replace(/\\/g, "/");
    if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
      return cleanPath;
    }
    return `${API_BASE_URL}/${cleanPath.replace(/^\/+/, "")}`;
  };

  const formatDate = (dateStr?: string) => {
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

  // Filtered & Sorted Leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!stats?.leaderboard) return [];

    let list = [...stats.leaderboard];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.fullName.toLowerCase().includes(term) ||
          t.email.toLowerCase().includes(term)
      );
    }

    if (filterPosition) {
      list = list.filter((t) => t.position === filterPosition);
    }

    if (filterStatus) {
      list = list.filter((t) => String(t.status.id) === filterStatus);
    }

    list.sort((a, b) => {
      if (sortBy === "questions_desc") {
        return b.questionsCount - a.questionsCount;
      }
      if (sortBy === "exams_desc") {
        return b.examsCount - a.examsCount;
      }
      if (sortBy === "name_asc") {
        return a.fullName.localeCompare(b.fullName, "vi");
      }
      return 0;
    });

    return list;
  }, [stats?.leaderboard, searchTerm, filterPosition, filterStatus, sortBy]);

  // Donut Chart: Cơ cấu chức vụ (Bậc 1 vs Bậc 2)
  const donutChartOptions: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Outfit, sans-serif",
    },
    labels: stats?.positionDistribution?.labels || ["Bậc 1", "Bậc 2"],
    colors: ["#465FFF", "#10B981"],
    legend: {
      position: "bottom",
      fontSize: "13px",
      fontWeight: 500,
      labels: {
        colors: "#6B7280",
      },
      markers: {
        size: 5,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Tổng giảng viên",
              fontSize: "12px",
              color: "#6B7280",
              formatter: () => `${stats?.overview?.totalTeachers || 0}`,
            },
            value: {
              fontSize: "24px",
              fontWeight: 700,
              color: "#111827",
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      y: {
        formatter: (val) => `${val} giảng viên`,
      },
    },
    stroke: {
      width: 0,
    },
  };

  // Productivity Timeline Chart: Câu hỏi & Đề thi qua 6 tháng
  const timelineChartOptions: ApexOptions = {
    chart: {
      type: "area",
      fontFamily: "Outfit, sans-serif",
      toolbar: {
        show: false,
      },
    },
    colors: ["#465FFF", "#F59E0B"],
    stroke: {
      curve: "smooth",
      width: [2.5, 2.5],
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    xaxis: {
      categories: stats?.productivityTimeline?.categories || [
        "Thg 5",
        "Thg 6",
        "Thg 7",
        "Thg 8",
        "Thg 9",
        "Thg 10",
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "12px",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "12px",
        },
      },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4,
    },
    legend: {
      position: "top",
      horizontalAlign: "right",
      fontSize: "13px",
      markers: {
        size: 5,
      },
    },
    dataLabels: {
      enabled: false,
    },
  };

  // Skills Bar Chart (Horizontal)
  const skillsBarOptions: ApexOptions = {
    chart: {
      type: "bar",
      fontFamily: "Outfit, sans-serif",
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: "55%",
        distributed: true,
      },
    },
    colors: ["#3B82F6", "#10B981", "#8B5CF6", "#F97316"],
    xaxis: {
      categories: stats?.skillsAndLevels?.skills?.labels || [
        "Nghe",
        "Đọc",
        "Viết",
        "Nói",
      ],
      labels: {
        style: {
          colors: "#6B7280",
          fontSize: "12px",
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: "#374151",
          fontSize: "13px",
          fontWeight: 500,
        },
      },
    },
    grid: {
      borderColor: "#E5E7EB",
      strokeDashArray: 4,
    },
    legend: {
      show: false,
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => `${val} câu`,
      style: {
        fontSize: "11px",
        fontWeight: 600,
        colors: ["#fff"],
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Thống kê giáo viên
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tổng quan năng suất, cơ cấu chức vụ và đóng góp học thuật của đội ngũ giảng viên TriceHSK.
          </p>
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
          {isRefreshing ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          <span>Không thể tải dữ liệu thống kê: {fetchError}</span>
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
        {/* Card 1: Tổng số giảng viên */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tổng số giảng viên
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <GroupIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : stats?.overview?.totalTeachers || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              người
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                (stats?.overview?.growthPercentage ?? 0) >= 0
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
              }`}
            >
              {(stats?.overview?.growthPercentage ?? 0) >= 0 ? (
                <ArrowUpIcon className="h-3 w-3" />
              ) : (
                <ArrowDownIcon className="h-3 w-3" />
              )}
              {stats?.overview?.growthPercentage ?? 0}%
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              so với tháng trước
            </span>
          </div>
        </div>

        {/* Card 2: Đang hoạt động */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Đang hoạt động
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : stats?.overview?.activeTeachers || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              người
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {stats?.overview?.totalTeachers
                ? Math.round(
                    ((stats.overview.activeTeachers || 0) /
                      stats.overview.totalTeachers) *
                      100
                  )
                : 0}
              %
            </span>
            <span>tổng số tài khoản</span>
          </div>
        </div>

        {/* Card 3: Đóng góp ngân hàng câu hỏi */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Ngân hàng câu hỏi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
              <DocsIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : stats?.overview?.totalQuestionsContributed || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              câu hỏi
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Bao gồm 4 kỹ năng HSK 1 - 9</span>
          </div>
        </div>

        {/* Card 4: Bộ đề & Đề thi đã tạo */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Bộ đề & Đề thi
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <ShootingStarIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : stats?.overview?.totalExamsContributed || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              bộ đề & đề thi
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              Đã cấu hình & xuất bản
            </span>
          </div>
        </div>
      </div>

      {/* 2. VISUAL CHARTS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chart 1: Cơ cấu chức vụ (Bậc 1 vs Bậc 2) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 lg:col-span-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Cơ cấu chức vụ
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tỷ lệ phân bổ giữa Giảng viên Bậc 1 và Bậc 2
            </p>
          </div>

          <div className="py-2">
            {isLoading ? (
              <div className="h-60 flex items-center justify-center text-sm text-gray-400">
                Đang tải biểu đồ...
              </div>
            ) : (
              <ReactApexChart
                options={donutChartOptions}
                series={stats?.positionDistribution?.counts || [0, 0]}
                type="donut"
                height={260}
              />
            )}
          </div>

          {/* Detailed summary */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="rounded-xl bg-blue-50/60 p-3 text-center dark:bg-blue-900/10">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Bậc 1
              </span>
              <div className="mt-1 text-lg font-bold text-gray-800 dark:text-white">
                {stats?.positionDistribution?.counts?.[0] || 0}
              </div>
              <span className="text-[11px] text-gray-500">
                {stats?.positionDistribution?.percentages?.[0] || 0}%
              </span>
            </div>

            <div className="rounded-xl bg-emerald-50/60 p-3 text-center dark:bg-emerald-900/10">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Bậc 2
              </span>
              <div className="mt-1 text-lg font-bold text-gray-800 dark:text-white">
                {stats?.positionDistribution?.counts?.[1] || 0}
              </div>
              <span className="text-[11px] text-gray-500">
                {stats?.positionDistribution?.percentages?.[1] || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Chart 2: Năng suất đóng góp học thuật theo thời gian */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 lg:col-span-8">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Năng suất đóng góp học thuật
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Số lượng câu hỏi và đề thi mới được biên soạn qua từng tháng
              </p>
            </div>
          </div>

          <div className="py-1">
            {isLoading ? (
              <div className="h-72 flex items-center justify-center text-sm text-gray-400">
                Đang tải biểu đồ...
              </div>
            ) : (
              <ReactApexChart
                options={timelineChartOptions}
                series={[
                  {
                    name: "Câu hỏi biên soạn",
                    data: stats?.productivityTimeline?.questionsSeries || [0],
                  },
                  {
                    name: "Đề thi & Bộ đề",
                    data: stats?.productivityTimeline?.examsSeries || [0],
                  },
                ]}
                type="area"
                height={290}
              />
            )}
          </div>
        </div>
      </div>

      {/* Chart 3: Phân bổ theo Kỹ năng & Cấp độ HSK */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Phân bổ theo 4 kỹ năng */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 lg:col-span-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Phân bổ câu hỏi theo kỹ năng
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Khối lượng câu hỏi được giảng viên tập trung xây dựng
            </p>
          </div>

          <div className="py-1">
            {isLoading ? (
              <div className="h-56 flex items-center justify-center text-sm text-gray-400">
                Đang tải biểu đồ...
              </div>
            ) : (
              <ReactApexChart
                options={skillsBarOptions}
                series={[
                  {
                    name: "Số câu hỏi",
                    data: stats?.skillsAndLevels?.skills?.counts || [0, 0, 0, 0],
                  },
                ]}
                type="bar"
                height={230}
              />
            )}
          </div>
        </div>

        {/* Phân bổ theo cấp độ HSK */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6 lg:col-span-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Phân bổ câu hỏi theo cấp độ HSK
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tỷ trọng nội dung đào tạo từ HSK 1 đến HSK 6
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 pt-2">
            {(stats?.skillsAndLevels?.levels?.labels || [
              "HSK 1",
              "HSK 2",
              "HSK 3",
              "HSK 4",
              "HSK 5",
              "HSK 6",
            ]).map((lvl, index) => {
              const count = stats?.skillsAndLevels?.levels?.counts?.[index] || 0;
              const total = stats?.overview?.totalQuestionsContributed || 1;
              const percent = Math.round((count / total) * 100);

              return (
                <div
                  key={lvl}
                  className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-800/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {lvl}
                    </span>
                    <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                      {percent}%
                    </span>
                  </div>
                  <div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                    {count}
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.min(100, Math.max(percent, count > 0 ? 5 : 0))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. BẢNG XẾP HẠNG & CHI TIẾT ĐÓNG GÓP */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Bảng xếp hạng đóng góp giảng viên
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Chi tiết hiệu suất và hoạt động biên soạn học thuật của từng giảng viên
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
                placeholder="Tìm giảng viên..."
                className="w-48 sm:w-56 rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>

            {/* Position filter */}
            <select
              value={filterPosition}
              onChange={(e) => setFilterPosition(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <option value="">Tất cả chức vụ</option>
              <option value="Bậc 1">Bậc 1</option>
              <option value="Bậc 2">Bậc 2</option>
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="1">Đang hoạt động</option>
              <option value="2">Đã hủy</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            >
              <option value="questions_desc">Nhiều câu hỏi nhất</option>
              <option value="exams_desc">Nhiều đề thi nhất</option>
              <option value="name_asc">Tên (A-Z)</option>
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
                  className="w-32 min-w-[120px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Ảnh đại diện
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[220px] pl-6 pr-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Giảng viên
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[110px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Chức vụ
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[150px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Câu hỏi đã tạo
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Đề thi đã tạo
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[140px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Lần hoạt động cuối
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
              {filteredLeaderboard.map((teacher, index) => {
                const avatarSrc = getAvatarUrl(teacher.photo);
                const initial = (teacher.fullName || teacher.email || "G")
                  .charAt(0)
                  .toUpperCase();
                const rank = index + 1;
                const hasContributions = teacher.questionsCount > 0 || teacher.examsCount > 0;

                return (
                  <TableRow key={teacher.id}>
                    {/* Hạng */}
                    <TableCell className="w-16 px-4 py-3.5 text-center">
                      {hasContributions && rank === 1 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xs shadow-sm">
                          🥇 1
                        </span>
                      ) : hasContributions && rank === 2 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 font-bold text-xs shadow-sm">
                          🥈 2
                        </span>
                      ) : hasContributions && rank === 3 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-800 font-bold text-xs border border-amber-300">
                          🥉 3
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                          #{rank}
                        </span>
                      )}
                    </TableCell>

                    {/* Ảnh đại diện */}
                    <TableCell className="w-32 min-w-[120px] px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center">
                        {avatarSrc ? (
                          <div className="relative w-10 h-10 overflow-hidden rounded-full border border-gray-200 dark:border-gray-700">
                            <Image
                              src={avatarSrc}
                              alt={teacher.email}
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
                    </TableCell>

                    {/* Giảng viên: Tên + Email */}
                    <TableCell className="min-w-[220px] pl-6 pr-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                          {teacher.fullName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {teacher.email}
                        </span>
                      </div>
                    </TableCell>

                    {/* Chức vụ */}
                    <TableCell className="min-w-[110px] px-4 py-3.5 text-center">
                      <Badge
                        size="sm"
                        color={teacher.position === "Bậc 2" ? "success" : "info"}
                      >
                        {teacher.position || "Bậc 1"}
                      </Badge>
                    </TableCell>

                    {/* Câu hỏi đã tạo */}
                    <TableCell className="min-w-[150px] px-4 py-3.5 text-center">
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        {teacher.questionsCount}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">câu</span>
                    </TableCell>

                    {/* Đề thi đã tạo */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          teacher.examsCount > 0
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {teacher.examsCount} đề
                      </span>
                    </TableCell>

                    {/* Lần hoạt động cuối */}
                    <TableCell className="min-w-[140px] px-4 py-3.5 text-center text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(teacher.lastActive)}
                    </TableCell>

                    {/* Trạng thái */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      <Badge
                        size="sm"
                        color={teacher.status.id === 1 ? "success" : "error"}
                      >
                        {teacher.status.name}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredLeaderboard.length === 0 && !isLoading && (
                <TableRow>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Không tìm thấy giảng viên nào phù hợp với điều kiện lọc.
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
