"use client";
import { useCallback } from "react";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { errorMessage } from "@/lib/error-message";

import React, { useEffect, useState } from "react";

import { apiFetch, readApiError } from "@/lib/api";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  TimeIcon,
  CheckCircleIcon,
  GroupIcon,
  DocsIcon,
  EyeIcon,
  CloseIcon,
  ShootingStarIcon,
} from "@/icons";

interface AuditLogItem {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[] | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogSummary {
  totalLogs: number;
  todayLogs: number;
  mostActiveUser: string | null;
  actionBreakdown: Record<string, number>;
  entityBreakdown: Record<string, number>;
}

export default function AuditLogsTable() {
  const requests = useLatestRequest();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Pagination & Filter States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [limit] = useState(12);

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [selectedAction, setSelectedAction] = useState("ALL");

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(
    async (currentPage = 1) => {
      const request = requests.start();
      try {
        setFetchError(null);
        let queryUrl = `audit-logs?page=${currentPage}&limit=${limit}`;
        if (appliedSearchTerm.trim()) {
          queryUrl += `&search=${encodeURIComponent(appliedSearchTerm.trim())}`;
        }
        if (selectedEntity !== "ALL") {
          queryUrl += `&entityType=${selectedEntity}`;
        }
        if (selectedAction !== "ALL") {
          queryUrl += `&action=${selectedAction}`;
        }

        const res = await apiFetch(queryUrl, {
          signal: request.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (!request.isCurrent()) return;
          setPage(currentPage);
          setLogs(json.data || []);
          setTotalPages(json.totalPages || 1);
          setTotalItems(json.total || 0);
        } else {
          const errMsg = await readApiError(res);
          setFetchError(errMsg || `Lỗi HTTP ${res.status}`);
        }
      } catch (err) {
        if (!request.isCurrent()) return;
        console.error("Failed to load audit logs:", err);
        setFetchError(errorMessage(err, "") || "Không thể kết nối đến máy chủ");
      } finally {
        if (request.isCurrent()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [requests, limit, appliedSearchTerm, selectedEntity, selectedAction],
  );

  const fetchSummary = useCallback(async () => {
    try {
      const res = await apiFetch("audit-logs/summary", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setSummary(json);
      }
    } catch (err) {
      console.error("Failed to load summary stats:", err);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    void fetchLogs(1);
    setPage(1);
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (appliedSearchTerm === searchTerm.trim()) void fetchLogs(1);
    else setAppliedSearchTerm(searchTerm.trim());
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLogs(page);
    fetchSummary();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchLogs(newPage);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date().getTime();
      const past = new Date(dateStr).getTime();
      const diffMinutes = Math.floor((now - past) / (1000 * 60));

      if (diffMinutes < 1) return "Vừa xong";
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return "";
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Tạo mới
          </span>
        );
      case "UPDATE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-800/40 dark:bg-blue-950/30 dark:text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Chỉnh sửa
          </span>
        );
      case "DELETE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Xóa
          </span>
        );
      case "RESET_PASSWORD":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Cấp mật khẩu
          </span>
        );
      case "STATUS_CHANGE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:border-purple-800/40 dark:bg-purple-950/30 dark:text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            Đổi trạng thái
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {action}
          </span>
        );
    }
  };

  const getEntityBadge = (entityType: string, entityId: string) => {
    switch (entityType) {
      case "TEACHER":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
            👨‍🏫 Giảng viên #{entityId}
          </span>
        );
      case "STUDENT":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
            🎓 Học viên #{entityId}
          </span>
        );
      case "QUESTION":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
            📝 Câu hỏi #{entityId}
          </span>
        );
      case "EXAM":
      case "PRACTICE_SET":
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            📚 Bộ đề #{entityId}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {entityType} #{entityId}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <TimeIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
                Truy vết chỉnh sửa (Audit Logs)
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lịch sử ghi nhận toàn diện các hành động tạo, chỉnh sửa, xóa và
                thay đổi dữ liệu trong hệ thống
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
          <span>Không thể tải nhật ký thao tác: {fetchError}</span>
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
        {/* Card 1: Tổng số thao tác */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Tổng số thao tác
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <DocsIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : summary?.totalLogs || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              bản ghi
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Được lưu vết bảo mật trong cơ sở dữ liệu
          </div>
        </div>

        {/* Card 2: Thao tác hôm nay */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Hôm nay
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {isLoading ? "..." : summary?.todayLogs || 0}
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              thao tác
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Ghi nhận theo thời gian thực
          </div>
        </div>

        {/* Card 3: Người thao tác nhiều nhất */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Quản trị viên tích cực
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
              <GroupIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white truncate max-w-[200px]">
              {isLoading ? "..." : summary?.mostActiveUser || "Admin"}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Thực hiện nhiều tác vụ quản trị nhất
          </div>
        </div>

        {/* Card 4: Cơ cấu thao tác */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Cơ cấu thao tác
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <ShootingStarIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-xs">
              <span className="text-gray-500">Sửa: </span>
              <strong className="text-blue-600 dark:text-blue-400">
                {summary?.actionBreakdown?.UPDATE || 0}
              </strong>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Tạo: </span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {summary?.actionBreakdown?.CREATE || 0}
              </strong>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">Khác: </span>
              <strong className="text-amber-600 dark:text-amber-400">
                {(summary?.actionBreakdown?.RESET_PASSWORD || 0) +
                  (summary?.actionBreakdown?.STATUS_CHANGE || 0)}
              </strong>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Phân bổ loại hành động chỉnh sửa
          </div>
        </div>
      </div>

      {/* 2. BẢNG DỮ LIỆU VÀ BỘ LỌC */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Nhật ký thay đổi hệ thống
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Tổng cộng có {totalItems} thao tác được ghi nhận
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search form */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nội dung, email, ID..."
                className="w-52 sm:w-60 rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </form>

            {/* Entity Type Filter */}
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="ALL">Tất cả đối tượng</option>
              <option value="TEACHER">Giảng viên</option>
              <option value="STUDENT">Học viên</option>
              <option value="QUESTION">Câu hỏi</option>
              <option value="EXAM">Đề thi & Bộ đề</option>
            </select>

            {/* Action Filter */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-theme-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="CREATE">Tạo mới</option>
              <option value="UPDATE">Chỉnh sửa</option>
              <option value="DELETE">Xóa</option>
              <option value="RESET_PASSWORD">Cấp mật khẩu</option>
              <option value="STATUS_CHANGE">Đổi trạng thái</option>
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
                  className="min-w-[170px] px-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Thời gian
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[200px] px-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Người thực hiện
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[130px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Hành động
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[150px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Đối tượng
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[300px] px-4 py-3.5 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Nội dung tóm tắt
                </TableCell>
                <TableCell
                  isHeader
                  className="min-w-[120px] px-4 py-3.5 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Chi tiết
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logs.map((log) => {
                const initial = (log.userName || "A").charAt(0).toUpperCase();

                return (
                  <TableRow
                    key={log.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition"
                  >
                    {/* Thời gian */}
                    <TableCell className="min-w-[170px] px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800 text-xs dark:text-white/90">
                          {formatDate(log.createdAt)}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Người thực hiện */}
                    <TableCell className="min-w-[200px] px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 text-white font-semibold text-xs shadow-sm">
                          {initial}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800 text-theme-sm dark:text-white/90">
                            {log.userName || "Admin"}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[160px]">
                            {log.userEmail || "Hệ thống"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Hành động */}
                    <TableCell className="min-w-[130px] px-4 py-3.5 text-center">
                      {getActionBadge(log.action)}
                    </TableCell>

                    {/* Đối tượng */}
                    <TableCell className="min-w-[150px] px-4 py-3.5 text-center">
                      {getEntityBadge(log.entityType, log.entityId)}
                    </TableCell>

                    {/* Nội dung tóm tắt */}
                    <TableCell className="min-w-[300px] px-4 py-3.5 text-sm text-gray-800 dark:text-gray-200">
                      <span>{log.summary}</span>
                      {log.changedFields && log.changedFields.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {log.changedFields.map((field) => (
                            <span
                              key={field}
                              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    {/* Thao tác xem chi tiết */}
                    <TableCell className="min-w-[120px] px-4 py-3.5 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 dark:hover:text-brand-400"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        So sánh
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {logs.length === 0 && !isLoading && (
                <TableRow>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    Chưa có nhật ký thao tác nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Trang {page} / {totalPages} (Tổng số {totalItems} thao tác)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Trước
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. DIFF VIEWER MODAL (POPUP SO SÁNH TRƯỚC VÀ SAU) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  <TimeIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Chi tiết thay đổi & So sánh dữ liệu
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bản ghi #{selectedLog.id} •{" "}
                    {formatDate(selectedLog.createdAt)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Action & User Info Overview */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/50 text-xs">
              <div>
                <span className="text-gray-400 block mb-1">
                  Người thực hiện
                </span>
                <strong className="text-gray-800 dark:text-white text-sm">
                  {selectedLog.userName}
                </strong>
                <p className="text-gray-500">{selectedLog.userEmail}</p>
              </div>

              <div>
                <span className="text-gray-400 block mb-1">
                  Hành động & Đối tượng
                </span>
                <div className="flex items-center gap-2 mt-1">
                  {getActionBadge(selectedLog.action)}
                  {getEntityBadge(selectedLog.entityType, selectedLog.entityId)}
                </div>
              </div>

              <div>
                <span className="text-gray-400 block mb-1">
                  Tóm tắt thao tác
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {selectedLog.summary}
                </span>
              </div>
            </div>

            {/* Changed fields badges */}
            {selectedLog.changedFields &&
              selectedLog.changedFields.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span className="text-gray-500 font-medium">
                    Các trường bị tác động:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLog.changedFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40 dark:text-amber-400"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* BEFORE VS AFTER DIFF VIEWER */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dữ liệu CŨ (TRƯỚC) */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/30 dark:bg-rose-950/10">
                <div className="flex items-center justify-between pb-3 border-b border-rose-200/60 dark:border-rose-900/30 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold text-xs">
                      -
                    </span>
                    <h4 className="font-bold text-rose-800 dark:text-rose-400 text-sm">
                      Dữ liệu Trước khi sửa (Old Data)
                    </h4>
                  </div>
                  <span className="text-[11px] text-rose-600 font-medium">
                    Ban đầu
                  </span>
                </div>

                {selectedLog.oldData ? (
                  <pre className="text-xs font-mono bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/20 overflow-x-auto text-gray-800 dark:text-gray-200 max-h-72">
                    {JSON.stringify(selectedLog.oldData, null, 2)}
                  </pre>
                ) : (
                  <div className="py-10 text-center text-xs text-rose-600 italic">
                    Không có dữ liệu trước đó (Hành động Tạo mới)
                  </div>
                )}
              </div>

              {/* Dữ liệu MỚI (SAU) */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60 dark:border-emerald-900/30 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                      +
                    </span>
                    <h4 className="font-bold text-emerald-800 dark:text-emerald-400 text-sm">
                      Dữ liệu Sau khi sửa (New Data)
                    </h4>
                  </div>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    Hiện tại
                  </span>
                </div>

                {selectedLog.newData ? (
                  <pre className="text-xs font-mono bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/20 overflow-x-auto text-gray-800 dark:text-gray-200 max-h-72">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                ) : (
                  <div className="py-10 text-center text-xs text-emerald-600 italic">
                    Không có dữ liệu sau (Hành động Xóa hoàn toàn)
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
