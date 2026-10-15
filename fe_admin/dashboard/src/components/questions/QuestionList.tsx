"use client";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { HSK_COLORS } from "@/constants/hsk";
import { errorMessage } from "@/lib/error-message";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { apiFetch, API_BASE_URL, readApiError } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
import { preparationIssues } from "@/lib/question-editor";
import QuestionPreview from "./QuestionPreview";
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
    optionImages?: string[];
    audioTimestamp?: { start?: number; end?: number } | null;
    source?: { lessonTitle?: string; pdfPage?: number; item?: number | string };
    audioUrl?: string;
    imageUrl?: string;
    [key: string]: unknown;
  };
  correctAnswer: {
    answer?: string;
    explanation?: string;
    rubric?: string;
    [key: string]: unknown;
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

const SKILL_MAP: Record<
  string,
  {
    label: string;
    icon: string;
    color: "primary" | "success" | "warning" | "info";
  }
> = {
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
  const requests = useLatestRequest();
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
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedHsk, setSelectedHsk] = useState<string>("ALL");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>("ALL");
  const [selectedSourceLesson, setSelectedSourceLesson] = useState("ALL");
  const [selectedPreparation, setSelectedPreparation] = useState("ALL");

  // Preview Modal
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(
    null,
  );

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

  const fetchQuestions = useCallback(
    async (currentPage = 1) => {
      const request = requests.start();
      try {
        setErrorMsg(null);
        let url = `questions?page=${currentPage}&limit=${limit}`;

        if (appliedSearchTerm.trim()) {
          url += `&search=${encodeURIComponent(appliedSearchTerm.trim())}`;
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
        if (selectedSourceLesson !== "ALL")
          url += `&sourceLesson=${selectedSourceLesson}`;
        if (selectedPreparation !== "ALL")
          url += `&preparation=${selectedPreparation}`;
        if (selectedGameFilter === "true") {
          url += `&isGameQuestion=true`;
        } else if (selectedGameFilter === "false") {
          url += `&isGameQuestion=false`;
        }

        const res = await apiFetch(url, { signal: request.signal });
        if (!res.ok) {
          throw new Error(await readApiError(res));
        }

        const result = await res.json();
        if (!request.isCurrent()) return;
        setPage(currentPage);
        setQuestions(result.data || []);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.total || 0);
      } catch (err) {
        if (!request.isCurrent()) return;
        setErrorMsg(
          errorMessage(err, "") || "Không thể tải danh sách câu hỏi.",
        );
        setQuestions([]);
      } finally {
        if (request.isCurrent()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [
      requests,
      limit,
      appliedSearchTerm,
      selectedHsk,
      selectedSkill,
      selectedType,
      selectedDifficulty,
      selectedGameFilter,
      selectedSourceLesson,
      selectedPreparation,
    ],
  );

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchQuestions(1);
    setPage(1);
  }, [fetchQuestions]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchQuestions(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (appliedSearchTerm === searchTerm.trim()) void fetchQuestions(1);
    else setAppliedSearchTerm(searchTerm.trim());
  };

  const handleResetFilters = () => {
    if (
      !appliedSearchTerm &&
      [
        selectedHsk,
        selectedSkill,
        selectedType,
        selectedDifficulty,
        selectedGameFilter,
        selectedSourceLesson,
        selectedPreparation,
      ].every((value) => value === "ALL")
    )
      void fetchQuestions(1);
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedHsk("ALL");
    setSelectedSkill("ALL");
    setSelectedType("ALL");
    setSelectedDifficulty("ALL");
    setSelectedGameFilter("ALL");
    setSelectedSourceLesson("ALL");
    setSelectedPreparation("ALL");
    setPage(1);
  };

  // One player, keyed by question: several items may share one audio file.
  const toggleAudio = (question: QuestionItem) => {
    const url = resolveFileUrl(question.payload.audioUrl, API_BASE_URL);
    if (!url) return;
    const key = String(question.id);
    if (activeAudioUrl === key && isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    const timestamp = question.payload.audioTimestamp;
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      if (timestamp?.start) audio.currentTime = timestamp.start;
    };
    audio.ontimeupdate = () => {
      if (timestamp?.end !== undefined && audio.currentTime >= timestamp.end) {
        audio.pause();
        setIsPlayingAudio(false);
      }
    };
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    setActiveAudioUrl(key);
    void audio
      .play()
      .then(() => setIsPlayingAudio(true))
      .catch(() => setIsPlayingAudio(false));
  };
  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

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
    } catch (err) {
      alert("Xóa câu hỏi thất bại: " + errorMessage(err));
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
            Quản trị kho đề trắc nghiệm, bài nghe, đọc hiểu, tự luận từ HSK 1
            đến HSK 9
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
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Tổng câu hỏi
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <DocsIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary
                ? summary.totalQuestions.toLocaleString()
                : totalItems.toLocaleString()}
            </span>
            <Badge variant="light" color="primary" size="sm">
              HSK 1 - 9
            </Badge>
          </div>
        </div>

        {/* Listening Skills */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Kỹ năng Nghe hiểu
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
              <AudioIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.skillsCount?.LISTENING
                ? summary.skillsCount.LISTENING.toLocaleString()
                : "0"}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
              Kèm Audio
            </span>
          </div>
        </div>

        {/* Reading Skills */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Kỹ năng Đọc hiểu
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <FileIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.skillsCount?.READING
                ? summary.skillsCount.READING.toLocaleString()
                : "0"}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Chữ Hán & Pinyin
            </span>
          </div>
        </div>

        {/* Game PK Questions */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Câu hỏi Game PK 1v1
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
              <ShootingStarIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {summary?.gameQuestionsCount
                ? summary.gameQuestionsCount.toLocaleString()
                : "0"}
            </span>
            <Badge variant="light" color="warning" size="sm">
              Đấu trường
            </Badge>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
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
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Bài trong sách HSK 1
              </label>
              <select
                aria-label="Bài trong sách"
                value={selectedSourceLesson}
                onChange={(event) =>
                  setSelectedSourceLesson(event.target.value)
                }
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="ALL">Tất cả bài</option>
                <option value="0">Đề mô phỏng</option>
                {Array.from({ length: 15 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    Bài {index + 1}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Trạng thái biên soạn
              </label>
              <select
                aria-label="Trạng thái biên soạn"
                value={selectedPreparation}
                onChange={(event) => setSelectedPreparation(event.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="ready">Sẵn sàng</option>
                <option value="needs_audio">Chờ tải audio</option>
                <option value="needs_answer">Chờ đáp án / tiêu chí chấm</option>
                <option value="needs_review">Cần đối chiếu</option>
              </select>
            </div>
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
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  # Mã & Cấp độ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Kỹ năng & Dạng bài
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Nội dung câu hỏi
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Media
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Đáp án & Độ khó
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Thao tác
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-12 text-center text-gray-400 dark:text-gray-500"
                    colSpan={6}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">
                        Đang tải dữ liệu câu hỏi...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-12 text-center text-gray-400 dark:text-gray-500"
                    colSpan={6}
                  >
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
                  const skillInfo = SKILL_MAP[q.skill] || {
                    label: q.skill,
                    icon: "📝",
                    color: "light",
                  };
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
                          <span
                            className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-1 rounded-lg border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}
                          >
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
                          <Badge
                            variant="light"
                            color={skillInfo.color}
                            size="sm"
                          >
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
                          {q.payload.source && (
                            <p className="text-xs text-gray-500">
                              {q.payload.source.lessonTitle} · Trang PDF{" "}
                              {q.payload.source.pdfPage}
                            </p>
                          )}
                          {preparationIssues(q).length > 0 && (
                            <p className="text-xs text-amber-600">
                              {preparationIssues(q).join(" · ")}
                            </p>
                          )}
                          {q.payload?.pinyin && (
                            <p className="text-xs text-brand-600 dark:text-brand-400 font-mono">
                              {q.payload.pinyin}
                            </p>
                          )}
                          {q.payload?.translation && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic line-clamp-1">
                              &quot;{q.payload.translation}&quot;
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Media */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {hasAudio ? (
                            <button
                              onClick={() => toggleAudio(q)}
                              title="Nghe audio"
                              className={`p-2 rounded-lg transition-colors ${
                                activeAudioUrl === String(q.id) &&
                                isPlayingAudio
                                  ? "bg-brand-500 text-white animate-pulse"
                                  : "bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400"
                              }`}
                            >
                              <AudioIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-700">
                              -
                            </span>
                          )}

                          {hasImage ? (
                            <a
                              href={
                                resolveFileUrl(
                                  q.payload.imageUrl,
                                  API_BASE_URL,
                                ) ?? undefined
                              }
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
                              {q.correctAnswer?.rubric
                                ? "Chấm thủ công"
                                : q.correctAnswer?.answer
                                  ? `Đáp án: ${q.correctAnswer.answer}`
                                  : "Chờ đáp án"}
                            </span>
                            {q.isGameQuestion && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                                PK 1v1
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-amber-500 flex items-center">
                            {"★".repeat(Math.min(5, Math.max(1, q.difficulty)))}
                            {"☆".repeat(
                              Math.max(
                                0,
                                5 - Math.min(5, Math.max(1, q.difficulty)),
                              ),
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/questions/${q.id}/edit`}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600"
                          >
                            {q.skill === "LISTENING" && !hasAudio
                              ? "Gắn audio"
                              : "Sửa"}
                          </Link>
                          <button
                            onClick={() => {
                              setPreviewQuestion(q);
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

      <Modal
        isOpen={!!previewQuestion}
        onClose={() => setPreviewQuestion(null)}
        className="max-w-3xl p-6 sm:p-8"
      >
        {previewQuestion && (
          <div className="space-y-5">
            <QuestionPreview
              key={previewQuestion.id}
              question={previewQuestion}
            />
            <div className="flex justify-between gap-3">
              <Link
                href={`/questions/${previewQuestion.id}/edit`}
                className="text-sm font-medium text-brand-600"
              >
                Sửa đề / đáp án / audio
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewQuestion(null)}
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
              Xác nhận xóa câu hỏi #{deleteTargetId}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Hành động này sẽ xóa câu hỏi khỏi ngân hàng đề thi và được ghi lại
              trong nhật ký truy vết hệ thống.
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
