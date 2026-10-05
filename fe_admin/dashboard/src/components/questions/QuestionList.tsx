"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
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
  ShootingStarIcon,
  AudioIcon,
  FileIcon,
  CheckCircleIcon,
  CloseIcon,
  TimeIcon,
  DocsIcon,
} from "@/icons";

export interface QuestionItem {
  id: number;
  type: string;
  skill: string;
  difficulty: number;
  hskLevel: number;
  payload: {
    text?: string;
    pinyin?: string;
    translation?: string;
    options?: string[];
    audioUrl?: string;
    imageUrl?: string;
    [key: string]: any;
  };
  correctAnswer: {
    answer?: string;
    explanation?: string;
    [key: string]: any;
  } | null;
  isGameQuestion: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface QuestionSummary {
  totalQuestions: number;
  skillsCount: Record<string, number>;
  hskLevelsCount: Record<string, number>;
  gameQuestionsCount: number;
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

const SKILL_MAP: Record<string, { label: string; icon: string; color: "primary" | "success" | "warning" | "info" }> = {
  LISTENING: { label: "Nghe hiểu", icon: "🎧", color: "info" },
  READING: { label: "Đọc hiểu", icon: "📖", color: "primary" },
  WRITING: { label: "Viết", icon: "✍️", color: "warning" },
  SPEAKING: { label: "Nói / Phát âm", icon: "🎙️", color: "success" },
};

const TYPE_MAP: Record<string, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng / Sai",
  MATCHING: "Nối từ / Ghép câu",
  FILL_IN_BLANK: "Điền từ khuyết",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY: "Tự luận",
};

export default function QuestionList() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [summary, setSummary] = useState<QuestionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHsk, setSelectedHsk] = useState<string>("ALL");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>("ALL");

  // Preview Modal
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(null);
  const [studentChoice, setStudentChoice] = useState<string | null>(null);
  const [showAnswerInPreview, setShowAnswerInPreview] = useState(false);

  // Delete Modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Audio Playback
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchSummary = async () => {
    try {
      const res = await apiFetch("questions/summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      // Summary error is non-blocking
    }
  };

  const fetchQuestions = useCallback(async (currentPage = page) => {
    try {
      setErrorMsg(null);
      let url = `questions?page=${currentPage}&limit=${limit}`;

      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      if (selectedHsk !== "ALL") {
        url += `&hskLevel=${selectedHsk}`;
      }
      if (selectedSkill !== "ALL") {
        url += `&skill=${selectedSkill}`;
      }
      if (selectedType !== "ALL") {
        url += `&type=${selectedType}`;
      }
      if (selectedDifficulty !== "ALL") {
        url += `&difficulty=${selectedDifficulty}`;
      }
      if (selectedGameFilter === "true") {
        url += `&isGameQuestion=true`;
      } else if (selectedGameFilter === "false") {
        url += `&isGameQuestion=false`;
      }

      const res = await apiFetch(url);
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const result = await res.json();
      setQuestions(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tải danh sách câu hỏi.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, searchTerm, selectedHsk, selectedSkill, selectedType, selectedDifficulty, selectedGameFilter]);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchQuestions(1);
    setPage(1);
  }, [selectedHsk, selectedSkill, selectedType, selectedDifficulty, selectedGameFilter, fetchQuestions]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchQuestions(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQuestions(1);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedHsk("ALL");
    setSelectedSkill("ALL");
    setSelectedType("ALL");
    setSelectedDifficulty("ALL");
    setSelectedGameFilter("ALL");
    setPage(1);
  };

  // Audio Handler
  const toggleAudio = (url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (activeAudioUrl === url && isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.src = url;
      audioRef.current.play().then(() => {
        setActiveAudioUrl(url);
        setIsPlayingAudio(true);
      }).catch(() => {
        setIsPlayingAudio(false);
      });
    }
  };

  // Delete Handler
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`questions/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await readApiError(res));
      }
      setDeleteTargetId(null);
      fetchQuestions(page);
      fetchSummary();
    } catch (err: any) {
      alert("Xóa câu hỏi thất bại: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ngân hàng câu hỏi HSK
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quản trị kho đề trắc nghiệm, bài nghe, đọc hiểu, tự luận từ HSK 1 đến HSK 9
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchQuestions(page);
              fetchSummary();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Đang đồng bộ..." : "Làm mới"}
          </Button>
          <Link href="/questions/create">
            <Button size="sm" startIcon={<PlusIcon className="w-5 h-5" />}>
              Thêm câu hỏi mới
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Questions */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tổng câu hỏi</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <DocsIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary ? summary.totalQuestions.toLocaleString() : totalItems.toLocaleString()}
            </span>
            <Badge variant="light" color="primary" size="sm">HSK 1 - 9</Badge>
          </div>
        </div>

        {/* Listening Skills */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Kỹ năng Nghe hiểu</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
              <AudioIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.skillsCount?.LISTENING ? summary.skillsCount.LISTENING.toLocaleString() : "0"}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">Kèm Audio</span>
          </div>
        </div>

        {/* Reading Skills */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Kỹ năng Đọc hiểu</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <FileIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.skillsCount?.READING ? summary.skillsCount.READING.toLocaleString() : "0"}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Chữ Hán & Pinyin</span>
          </div>
        </div>

        {/* Game PK Questions */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Câu hỏi Game PK 1v1</span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
              <ShootingStarIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.gameQuestionsCount ? summary.gameQuestionsCount.toLocaleString() : "0"}
            </span>
            <Badge variant="light" color="warning" size="sm">Đấu trường</Badge>
          </div>
        </div>
      </div>

      {/* Filter and Search Container */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm câu hỏi (chữ Hán, pinyin, dịch nghĩa)..."
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

            <div className="flex items-center gap-2">
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
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 pt-2 border-t border-gray-100 dark:border-gray-800">
            {/* HSK Level Filter */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Cấp độ HSK
              </label>
              <select
                value={selectedHsk}
                onChange={(e) => setSelectedHsk(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">Tất cả HSK (1-9)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    HSK {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Skill Filter */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Kỹ năng
              </label>
              <select
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">Tất cả kỹ năng</option>
                <option value="LISTENING">🎧 Nghe hiểu (Listening)</option>
                <option value="READING">📖 Đọc hiểu (Reading)</option>
                <option value="WRITING">✍️ Viết (Writing)</option>
                <option value="SPEAKING">🎙️ Nói (Speaking)</option>
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Dạng câu hỏi
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">Tất cả dạng bài</option>
                <option value="MULTIPLE_CHOICE">Trắc nghiệm</option>
                <option value="TRUE_FALSE">Đúng / Sai</option>
                <option value="MATCHING">Nối từ / Ghép câu</option>
                <option value="FILL_IN_BLANK">Điền từ khuyết</option>
                <option value="SHORT_ANSWER">Trả lời ngắn</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Độ khó
              </label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">Tất cả độ khó</option>
                <option value="1">⭐ 1 sao (Rất dễ)</option>
                <option value="2">⭐⭐ 2 sao (Dễ)</option>
                <option value="3">⭐⭐⭐ 3 sao (Trung bình)</option>
                <option value="4">⭐⭐⭐⭐ 4 sao (Khó)</option>
                <option value="5">⭐⭐⭐⭐⭐ 5 sao (Nâng cao)</option>
              </select>
            </div>

            {/* Game PK Filter */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Chế độ Game PK
              </label>
              <select
                value={selectedGameFilter}
                onChange={(e) => setSelectedGameFilter(e.target.value)}
                className="w-full h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">Tất cả câu hỏi</option>
                <option value="true">Chỉ câu hỏi Game PK</option>
                <option value="false">Không phải Game</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Question Table View */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              Danh sách kết quả
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-300">
              {totalItems} câu hỏi
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
                  # Mã & Cấp độ
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Kỹ năng & Dạng bài
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Nội dung câu hỏi
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Media
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Đáp án & Độ khó
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
                      <span className="text-sm">Đang tải dữ liệu câu hỏi...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell className="px-5 py-12 text-center text-gray-400 dark:text-gray-500" {...({ colSpan: 6 } as any)}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DocsIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                        Chưa có câu hỏi nào phù hợp với bộ lọc
                      </p>
                      <Link href="/questions/create">
                        <Button size="sm" variant="outline" className="mt-2">
                          Thêm câu hỏi mới ngay
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((q) => {
                  const hskStyle = HSK_COLORS[q.hskLevel] || HSK_COLORS[1];
                  const skillInfo = SKILL_MAP[q.skill] || { label: q.skill, icon: "📝", color: "light" };
                  const hasAudio = !!q.payload?.audioUrl;
                  const hasImage = !!q.payload?.imageUrl;

                  return (
                    <TableRow
                      key={q.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 dark:border-gray-800/80 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      {/* ID & HSK Level */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-1 rounded-lg border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}>
                            HSK {q.hskLevel}
                          </span>
                          <span className="text-xs font-mono text-gray-400">
                            #{q.id}
                          </span>
                        </div>
                      </TableCell>

                      {/* Skill & Type */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant="light" color={skillInfo.color} size="sm">
                            <span className="mr-1">{skillInfo.icon}</span>
                            {skillInfo.label}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {TYPE_MAP[q.type] || q.type}
                          </span>
                        </div>
                      </TableCell>

                      {/* Question Content */}
                      <TableCell className="px-5 py-4 max-w-md">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                            {q.payload?.text || "Chưa có nội dung"}
                          </p>
                          {q.payload?.pinyin && (
                            <p className="text-xs text-brand-600 dark:text-brand-400 font-mono">
                              {q.payload.pinyin}
                            </p>
                          )}
                          {q.payload?.translation && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic line-clamp-1">
                              "{q.payload.translation}"
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Media */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {hasAudio ? (
                            <button
                              onClick={() => toggleAudio(q.payload.audioUrl!)}
                              title="Nghe audio"
                              className={`p-2 rounded-lg transition-colors ${
                                activeAudioUrl === q.payload.audioUrl && isPlayingAudio
                                  ? "bg-brand-500 text-white animate-pulse"
                                  : "bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400"
                              }`}
                            >
                              <AudioIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700">-</span>
                          )}

                          {hasImage ? (
                            <a
                              href={q.payload.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Xem ảnh minh họa"
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 transition-colors"
                            >
                              <FileIcon className="w-4 h-4" />
                            </a>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Answer & Difficulty */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800">
                              Đáp án: {q.correctAnswer?.answer || "N/A"}
                            </span>
                            {q.isGameQuestion && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                PK 1v1
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-amber-500 flex items-center">
                            {"★".repeat(Math.min(5, Math.max(1, q.difficulty)))}
                            {"☆".repeat(Math.max(0, 5 - Math.min(5, Math.max(1, q.difficulty))))}
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setPreviewQuestion(q);
                              setStudentChoice(null);
                              setShowAnswerInPreview(false);
                            }}
                            title="Xem trước mô phỏng học viên"
                            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(q.id)}
                            title="Xóa câu hỏi"
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
              Trang {page} / {totalPages} (Tổng {totalItems} câu)
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Student Simulator / Question Preview Modal */}
      <Modal
        isOpen={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        className="max-w-2xl p-6 sm:p-8"
      >
        {previewQuestion && (
          <div className="space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 font-bold text-sm rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  HSK {previewQuestion.hskLevel}
                </span>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {SKILL_MAP[previewQuestion.skill]?.label || previewQuestion.skill}
                </span>
                <span className="text-xs text-gray-400">
                  • {TYPE_MAP[previewQuestion.type] || previewQuestion.type}
                </span>
              </div>
              <div className="text-xs text-amber-500 font-semibold">
                Độ khó: {"★".repeat(previewQuestion.difficulty)}
              </div>
            </div>

            {/* Audio Player if Available */}
            {previewQuestion.payload?.audioUrl && (
              <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-xl dark:bg-sky-500/10 dark:border-sky-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleAudio(previewQuestion.payload.audioUrl!)}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 transition"
                    >
                      <AudioIcon className="w-5 h-5" />
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Tệp âm thanh bài nghe
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Nhấn để học viên nghe đoạn ghi âm
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-sky-600 dark:text-sky-400">
                    MP3 Audio
                  </span>
                </div>
              </div>
            )}

            {/* Image Preview if Available */}
            {previewQuestion.payload?.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-60 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <img
                  src={previewQuestion.payload.imageUrl}
                  alt="Minh họa câu hỏi"
                  className="max-h-60 object-contain"
                />
              </div>
            )}

            {/* Question Text & Chinese Typography */}
            <div className="p-5 bg-gray-50/80 rounded-2xl border border-gray-100 dark:bg-gray-800/40 dark:border-gray-800">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Nội dung câu hỏi
              </span>
              <p className="text-xl font-semibold text-gray-900 dark:text-white leading-relaxed tracking-wide font-sans">
                {previewQuestion.payload?.text}
              </p>
              {previewQuestion.payload?.pinyin && (
                <p className="mt-2 text-sm text-brand-600 dark:text-brand-400 font-mono">
                  {previewQuestion.payload.pinyin}
                </p>
              )}
              {previewQuestion.payload?.translation && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                  Dịch nghĩa: {previewQuestion.payload.translation}
                </p>
              )}
            </div>

            {/* Options Interactive Section */}
            {Array.isArray(previewQuestion.payload?.options) && previewQuestion.payload.options.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Chọn đáp án đúng (Mô phỏng học viên):
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {previewQuestion.payload.options.map((opt, idx) => {
                    const optKey = String.fromCharCode(65 + idx); // A, B, C, D
                    const isSelected = studentChoice === optKey;
                    const isCorrect = previewQuestion.correctAnswer?.answer === optKey;

                    let btnClass = "border-gray-200 bg-white hover:bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";
                    if (isSelected) {
                      btnClass = "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300 dark:border-brand-500 ring-2 ring-brand-500/20";
                    }
                    if (showAnswerInPreview && isCorrect) {
                      btnClass = "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500 ring-2 ring-emerald-500/20";
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => setStudentChoice(optKey)}
                        className={`flex items-center gap-3 p-3.5 text-left border rounded-xl transition-all ${btnClass}`}
                      >
                        <span className="flex items-center justify-center w-7 h-7 text-xs font-bold rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          {optKey}
                        </span>
                        <span className="text-sm font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Toggle Answer & Explanation */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAnswerInPreview(!showAnswerInPreview)}
                  className="text-xs font-semibold text-brand-500 hover:text-brand-600 dark:text-brand-400 flex items-center gap-1.5"
                >
                  <EyeIcon className="w-4 h-4" />
                  {showAnswerInPreview ? "Ẩn đáp án & giải thích" : "Xem đáp án chuẩn & giải thích"}
                </button>
                {studentChoice && (
                  <span className={`text-xs font-semibold ${
                    studentChoice === previewQuestion.correctAnswer?.answer
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-500 dark:text-rose-400"
                  }`}>
                    {studentChoice === previewQuestion.correctAnswer?.answer ? "✓ Học viên trả lời đúng" : "✗ Học viên chọn chưa chính xác"}
                  </span>
                )}
              </div>

              {showAnswerInPreview && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Đáp án chính xác:
                    </span>
                    <Badge variant="solid" color="success" size="sm">
                      {previewQuestion.correctAnswer?.answer || "N/A"}
                    </Badge>
                  </div>
                  {previewQuestion.correctAnswer?.explanation && (
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      <span className="font-semibold">Giải thích chi tiết: </span>
                      {previewQuestion.correctAnswer.explanation}
                    </p>
                  )}
                  {previewQuestion.payload?.transcript && (
                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-700/60">
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                        🎧 Lời thoại bài nghe (录音文本 / Transcript):
                      </p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed font-sans bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                        {previewQuestion.payload.transcript}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewQuestion(null)}
              >
                Đóng xem trước
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
              Xác nhận xóa câu hỏi #{deleteTargetId}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Hành động này sẽ xóa câu hỏi khỏi ngân hàng đề thi và được ghi lại trong nhật ký truy vết hệ thống.
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
