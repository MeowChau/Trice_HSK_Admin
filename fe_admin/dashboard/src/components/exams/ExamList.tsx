"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch, readApiError } from "@/lib/api";
import Badge from "../ui/badge/Badge";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Pagination from "../tables/Pagination";
import {
  PlusIcon,
  EyeIcon,
  TrashBinIcon,
  DocsIcon,
  FileIcon,
  CheckCircleIcon,
  TimeIcon,
  FolderIcon,
} from "@/icons";

export interface ExamItem {
  id: number;
  title: string;
  description: string;
  hskLevel: number;
  totalSections: number;
  totalQuestions: number;
  sections?: Array<{
    id: number;
    title: string;
    order: number;
    sectionQuestions?: Array<{
      id: number;
      questionId: number;
      order: number;
      question?: {
        id: number;
        type: string;
        skill: string;
        difficulty: number;
        payload: {
          text?: string;
          options?: string[];
          [key: string]: any;
        };
        correctAnswer?: {
          answer?: string;
          explanation?: string;
        };
      };
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}

const HSK_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
  2: { bg: "bg-teal-50 dark:bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-200 dark:border-teal-800" },
  3: { bg: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-600 dark:text-sky-400", border: "border-sky-200 dark:border-sky-800" },
  4: { bg: "bg-indigo-50 dark:bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-800" },
  5: { bg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
  6: { bg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-800" },
  7: { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-800" },
  8: { bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-200 dark:border-fuchsia-800" },
  9: { bg: "bg-violet-50 dark:bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800" },
};

export default function ExamList() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHsk, setSelectedHsk] = useState<string>("ALL");

  // Detail Modal
  const [detailExam, setDetailExam] = useState<ExamItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<number>(0);

  // Delete Modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchExams = useCallback(async (currentPage = page) => {
    try {
      setErrorMsg(null);
      let url = `exams?page=${currentPage}&limit=${limit}`;

      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      if (selectedHsk !== "ALL") {
        url += `&hskLevel=${selectedHsk}`;
      }

      const res = await apiFetch(url);
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const result = await res.json();
      setExams(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tải danh sách đề thi.");
      setExams([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, searchTerm, selectedHsk]);

  useEffect(() => {
    fetchExams(1);
    setPage(1);
  }, [selectedHsk, fetchExams]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchExams(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchExams(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedHsk("ALL");
    setPage(1);
  };

  // Open Exam Detail
  const openExamDetail = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await apiFetch(`exams/${id}`);
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setDetailExam(data);
      setActiveSectionTab(0);
    } catch (err: any) {
      alert("Không thể tải chi tiết đề thi: " + err.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Delete Exam
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`exams/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204 && res.status !== 200) {
        throw new Error(await readApiError(res));
      }
      setDeleteTargetId(null);
      fetchExams(page);
    } catch (err: any) {
      alert("Xóa đề thi thất bại: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculated Stats
  const primaryExamsCount = exams.filter((e) => e.hskLevel <= 2).length;
  const intermediateExamsCount = exams.filter((e) => e.hskLevel >= 3 && e.hskLevel <= 4).length;
  const advancedExamsCount = exams.filter((e) => e.hskLevel >= 5).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Danh sách đề thi chuẩn HSK
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản trị các bộ đề luyện tập và đề thi thử HSK cấp 1 đến cấp 9 đầy đủ cấu trúc các phần thi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchExams(page);
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Đang đồng bộ..." : "Làm mới"}
          </Button>
          <Link href="/exams/create">
            <Button size="sm" startIcon={<PlusIcon className="w-5 h-5" />}>
              Thêm đề thi mới
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Exams */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng số đề thi</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <DocsIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalItems.toLocaleString()}
            </span>
            <Badge variant="light" color="primary" size="sm">HSK 1 - 9</Badge>
          </div>
        </div>

        {/* Primary HSK 1-2 */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">HSK Sơ cấp (1-2)</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <FolderIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {primaryExamsCount.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Khởi động</span>
          </div>
        </div>

        {/* Intermediate HSK 3-4 */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">HSK Trung cấp (3-4)</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
              <FileIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {intermediateExamsCount.toLocaleString()}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Tiêu chuẩn</span>
          </div>
        </div>

        {/* Advanced HSK 5-9 */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">HSK Cao cấp (5-9)</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 text-purple-500 dark:bg-purple-500/10">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {advancedExamsCount.toLocaleString()}
            </span>
            <Badge variant="light" color="warning" size="sm">Chuyên sâu</Badge>
          </div>
        </div>
      </div>

      {/* Filter and Search Container */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên đề thi, nội dung hướng dẫn..."
              className="w-full h-11 pl-11 pr-4 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <svg
              className="absolute left-3.5 top-3 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedHsk}
              onChange={(e) => setSelectedHsk(e.target.value)}
              className="h-11 px-3.5 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="ALL">Tất cả HSK (1-9)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>

            <Button type="submit" size="sm">
              Tìm kiếm
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Đặt lại
            </Button>
          </div>
        </form>
      </div>

      {/* Exam Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              Danh sách đề thi
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-300">
              {totalItems} bộ đề
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 m-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl dark:bg-rose-500/10 dark:border-rose-900/40 dark:text-rose-400">
            {errorMsg}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
              <TableRow>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  # Mã & Tên đề thi
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Cấp độ HSK
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Mô tả & Hướng dẫn
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Cấu trúc phần thi
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Tổng câu hỏi
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell className="px-5 py-12 text-center text-gray-400 dark:text-gray-500" {...({ colSpan: 6 } as any)}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Đang tải dữ liệu đề thi...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : exams.length === 0 ? (
                <TableRow>
                  <TableCell className="px-5 py-12 text-center text-gray-400 dark:text-gray-500" {...({ colSpan: 6 } as any)}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DocsIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                        Chưa có đề thi nào trong danh sách
                      </p>
                      <Link href="/exams/create">
                        <Button size="sm" variant="outline" className="mt-2">
                          Biên soạn đề thi mới ngay
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((exam) => {
                  const hskStyle = HSK_COLORS[exam.hskLevel] || HSK_COLORS[1];

                  return (
                    <TableRow
                      key={exam.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 dark:border-gray-800/80 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Title & Code */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white hover:text-brand-500 transition-colors">
                            {exam.title}
                          </span>
                          <div className="text-xs font-mono text-gray-400">
                            Mã đề: #{exam.id}
                          </div>
                        </div>
                      </TableCell>

                      {/* HSK Badge */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-1 rounded-lg border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}>
                          HSK {exam.hskLevel}
                        </span>
                      </TableCell>

                      {/* Description */}
                      <TableCell className="px-5 py-4 max-w-sm">
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                          {exam.description || "Không có hướng dẫn"}
                        </p>
                      </TableCell>

                      {/* Sections Count */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {exam.totalSections} phần thi
                        </span>
                      </TableCell>

                      {/* Total Questions Count */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                          {exam.totalQuestions} câu hỏi
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openExamDetail(exam.id)}
                            title="Xem chi tiết cấu trúc đề thi"
                            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(exam.id)}
                            title="Xóa đề thi"
                            className="p-2 text-gray-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition-colors"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Trang {page} / {totalPages} (Tổng {totalItems} đề thi)
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Exam Detail Modal */}
      <Modal
        isOpen={!!detailExam}
        onClose={() => setDetailExam(null)}
        className="max-w-3xl p-6 sm:p-8"
      >
        {detailExam && (
          <div className="space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    HSK {detailExam.hskLevel}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {detailExam.title}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {detailExam.description || "Không có mô tả thêm."}
                </p>
              </div>
            </div>

            {/* Sections Tab Navigation */}
            {detailExam.sections && detailExam.sections.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-1">
                  {detailExam.sections.map((section, idx) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSectionTab(idx)}
                      className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                        activeSectionTab === idx
                          ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-500/10"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                    >
                      {section.title || `Phần ${idx + 1}`} ({section.sectionQuestions?.length || 0} câu)
                    </button>
                  ))}
                </div>

                {/* Section Question Content */}
                {detailExam.sections[activeSectionTab] && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        Danh sách các câu hỏi trong <strong>{detailExam.sections[activeSectionTab].title}</strong>:
                      </span>
                      <span>
                        Thứ tự phần: #{detailExam.sections[activeSectionTab].order}
                      </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                      {detailExam.sections[activeSectionTab].sectionQuestions &&
                      detailExam.sections[activeSectionTab].sectionQuestions!.length > 0 ? (
                        detailExam.sections[activeSectionTab].sectionQuestions!.map((sq, idx) => (
                          <div
                            key={sq.id || idx}
                            className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-gray-800/40 dark:border-gray-800 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                Câu {idx + 1} (Mã #{sq.questionId})
                              </span>
                              {sq.question?.skill && (
                                <Badge variant="light" color="info" size="sm">
                                  {sq.question.skill}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {sq.question?.payload?.text || "Chưa có nội dung chữ Hán"}
                            </p>
                            {sq.question?.correctAnswer?.answer && (
                              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                Đáp án chính xác: {sq.question.correctAnswer.answer}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-sm text-gray-400">
                          Chưa có câu hỏi nào được gán vào phần thi này.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-400">
                Đề thi này chưa thiết lập các phần thi (Sections).
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailExam(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        className="max-w-md p-6"
      >
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
            <TrashBinIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Xác nhận xóa bộ đề thi #{deleteTargetId}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Hành động này sẽ xóa đề thi và các cấu trúc phần thi liên quan trong hệ thống.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTargetId(null)}
              disabled={isDeleting}
            >
              Hủy bỏ
            </Button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition shadow-theme-xs"
            >
              {isDeleting ? "Đang xóa..." : "Xác nhận xóa"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
