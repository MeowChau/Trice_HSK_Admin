"use client";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { HSK_COLORS } from "@/constants/hsk";
import { errorMessage } from "@/lib/error-message";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL, apiFetch, readApiError } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
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
  AudioIcon,
  FileIcon,
  DocsIcon,
} from "@/icons";

export interface PracticeSetItem {
  id: number;
  title: string;
  topic: string;
  skill: string;
  hskLevel: number;
  audioUrl?: string;
  totalQuestions: number;
  practiceSetQuestions?: Array<{
    id: number;
    order: number;
    question?: {
      id: number;
      type: string;
      skill: string;
      difficulty: number;
      payload: {
        text?: string;
        pinyin?: string;
        options?: string[];
        audioUrl?: string;
      };
      correctAnswer?: {
        answer?: string;
        explanation?: string;
      };
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

interface SkillDataManagerProps {
  skill: "LISTENING" | "SPEAKING" | "READING" | "WRITING";
  pageTitle: string;
  subtitle: string;
}

export default function SkillDataManager({
  skill,
  pageTitle,
  subtitle,
}: SkillDataManagerProps) {
  const requests = useLatestRequest();
  const searchParams = useSearchParams();
  const initialTopic = searchParams?.get("topic") || "ALL";

  const [sets, setSets] = useState<PracticeSetItem[]>([]);
  const [topics, setTopics] = useState<
    Array<{ topicKey: string; titleVi: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [selectedHsk, setSelectedHsk] = useState<string>("ALL");
  const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formTopic, setFormTopic] = useState("Topic 1");
  const [formHskLevel, setFormHskLevel] = useState(1);
  const [formAudioUrl, setFormAudioUrl] = useState("");
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUploadStatus, setAudioUploadStatus] = useState<string | null>(
    null,
  );
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Detail Modal
  const [detailSet, setDetailSet] = useState<PracticeSetItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Delete Modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Audio Playback for Listening
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const handleAudioUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioUploadStatus(`Đang tải lên "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("files/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      const path = data?.file?.path;
      if (path) {
        const fullUrl =
          path.startsWith("http") || path.startsWith("/")
            ? path
            : `/api/v1/files/${path}`;
        setFormAudioUrl(fullUrl);
        setAudioUploadStatus(`✓ Đã tải: ${file.name}`);
      }
    } catch (err) {
      setAudioUploadStatus(null);
      alert("Lỗi tải tệp âm thanh: " + errorMessage(err));
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Detail Modal Audio Upload
  const [isUpdatingDetailAudio, setIsUpdatingDetailAudio] = useState(false);
  const detailAudioInputRef = useRef<HTMLInputElement | null>(null);

  const handleDetailAudioUpload = async (file: File) => {
    if (!file || !detailSet) return;
    setIsUpdatingDetailAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch("files/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      const path = data?.file?.path;
      if (path) {
        const fullUrl =
          path.startsWith("http") || path.startsWith("/")
            ? path
            : `/api/v1/files/${path}`;
        const updateRes = await apiFetch(`practice-sets/${detailSet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl: fullUrl }),
        });
        if (!updateRes.ok) throw new Error(await readApiError(updateRes));
        setDetailSet((prev) => (prev ? { ...prev, audioUrl: fullUrl } : null));
        fetchPracticeSets(page);
      }
    } catch (err) {
      alert("Lỗi tải tệp âm thanh: " + errorMessage(err));
    } finally {
      setIsUpdatingDetailAudio(false);
    }
  };

  const handleRemoveDetailAudio = async () => {
    if (!detailSet) return;
    if (!confirm("Bạn có chắc muốn gỡ file âm thanh khỏi bài học này?")) return;
    setIsUpdatingDetailAudio(true);
    try {
      const updateRes = await apiFetch(`practice-sets/${detailSet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: null }),
      });
      if (!updateRes.ok) throw new Error(await readApiError(updateRes));
      setDetailSet((prev) => (prev ? { ...prev, audioUrl: undefined } : null));
      fetchPracticeSets(page);
    } catch (err) {
      alert("Lỗi gỡ tệp âm thanh: " + errorMessage(err));
    } finally {
      setIsUpdatingDetailAudio(false);
    }
  };

  // Question Picker for Practice Set
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<
    {
      id: number;
      type: string;
      payload: { text?: string; audioUrl?: string };
    }[]
  >([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [isLoadingPickerQuestions, setIsLoadingPickerQuestions] =
    useState(false);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  const openQuestionPicker = async () => {
    if (!detailSet) return;
    setIsQuestionPickerOpen(true);
    setIsLoadingPickerQuestions(true);
    try {
      const currentIds =
        (detailSet.practiceSetQuestions
          ?.map((pq) => pq.question?.id)
          .filter(Boolean) as number[]) || [];
      setSelectedQuestionIds(currentIds);

      const res = await apiFetch(
        `questions?skill=${detailSet.skill}&hskLevel=${detailSet.hskLevel}&limit=100`,
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableQuestions(data.data || []);
      }
    } catch (err) {
      alert("Không thể tải danh sách câu hỏi: " + errorMessage(err));
    } finally {
      setIsLoadingPickerQuestions(false);
    }
  };

  const handleToggleQuestionSelect = (qId: number) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId],
    );
  };

  const handleSaveQuestionsToSet = async () => {
    if (!detailSet) return;
    setIsSavingQuestions(true);
    try {
      const payload = {
        questions: selectedQuestionIds.map((id, index) => ({
          questionId: id,
          order: index + 1,
        })),
      };

      const res = await apiFetch(`practice-sets/${detailSet.id}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      setIsQuestionPickerOpen(false);
      await openDetail(detailSet.id);
      fetchPracticeSets(page);
    } catch (err) {
      alert("Lỗi cập nhật danh sách câu hỏi: " + errorMessage(err));
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const fetchTopicsList = async () => {
    try {
      const res = await apiFetch("practice-sets/topics");
      if (res.ok) {
        const data = await res.json();
        setTopics(data || []);
      }
    } catch {
      // Non-blocking
    }
  };

  const fetchPracticeSets = useCallback(
    async (currentPage = 1) => {
      const request = requests.start();
      try {
        setErrorMsg(null);
        let url = `practice-sets?page=${currentPage}&limit=${limit}&skill=${skill}`;

        if (appliedSearchTerm.trim()) {
          url += `&search=${encodeURIComponent(appliedSearchTerm.trim())}`;
        }
        if (selectedHsk !== "ALL") {
          url += `&hskLevel=${selectedHsk}`;
        }
        if (selectedTopic !== "ALL") {
          url += `&topic=${encodeURIComponent(selectedTopic)}`;
        }

        const res = await apiFetch(url, { signal: request.signal });
        if (!res.ok) {
          throw new Error(await readApiError(res));
        }

        const result = await res.json();
        if (!request.isCurrent()) return;
        setPage(currentPage);
        setSets(result.data || []);
        setTotalPages(result.totalPages || 1);
        setTotalItems(result.total || 0);
      } catch (err) {
        if (!request.isCurrent()) return;
        setErrorMsg(
          errorMessage(err, "") || "Không thể tải danh sách bài luyện tập.",
        );
        setSets([]);
      } finally {
        if (request.isCurrent()) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [requests, limit, skill, appliedSearchTerm, selectedHsk, selectedTopic],
  );

  useEffect(() => {
    fetchTopicsList();
  }, []);

  useEffect(() => {
    fetchPracticeSets(1);
    setPage(1);
  }, [selectedHsk, selectedTopic, fetchPracticeSets]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPracticeSets(newPage);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    if (appliedSearchTerm === searchTerm.trim()) void fetchPracticeSets(1);
    else setAppliedSearchTerm(searchTerm.trim());
  };

  const handleResetFilters = () => {
    if (!appliedSearchTerm && selectedHsk === "ALL" && selectedTopic === "ALL")
      void fetchPracticeSets(1);
    setSearchTerm("");
    setAppliedSearchTerm("");
    setSelectedHsk("ALL");
    setSelectedTopic("ALL");
    setPage(1);
  };

  // Open Detail
  const openDetail = async (id: number) => {
    setIsLoadingDetail(true);
    try {
      const res = await apiFetch(`practice-sets/${id}`);
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setDetailSet(data);
    } catch (err) {
      alert("Không thể tải chi tiết bài luyện tập: " + errorMessage(err));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Audio Handler
  const toggleAudio = (url: string) => {
    const resolvedUrl = resolveFileUrl(url, API_BASE_URL);
    if (!resolvedUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setIsPlayingAudio(false);
    }

    if (activeAudioUrl === url && isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.src = resolvedUrl;
      audioRef.current
        .play()
        .then(() => {
          setActiveAudioUrl(url);
          setIsPlayingAudio(true);
        })
        .catch(() => {
          setIsPlayingAudio(false);
        });
    }
  };

  // Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Vui lòng nhập tên bài luyện tập.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await apiFetch("practice-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          topic: formTopic,
          skill,
          hskLevel: Number(formHskLevel),
          audioUrl:
            skill === "LISTENING" && formAudioUrl.trim()
              ? formAudioUrl.trim()
              : null,
        }),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      setIsCreateOpen(false);
      setFormTitle("");
      setFormAudioUrl("");
      setAudioUploadStatus(null);
      fetchPracticeSets(1);
    } catch (err) {
      alert("Tạo bài luyện tập thất bại: " + errorMessage(err));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Delete Submit
  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`practice-sets/${deleteTargetId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204 && res.status !== 200) {
        throw new Error(await readApiError(res));
      }
      setDeleteTargetId(null);
      fetchPracticeSets(page);
    } catch (err) {
      alert("Xóa bài luyện tập thất bại: " + errorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // KPI Calculations
  const primaryCount = sets.filter((s) => s.hskLevel <= 2).length;
  const intermediateCount = sets.filter(
    (s) => s.hskLevel >= 3 && s.hskLevel <= 4,
  ).length;
  const advancedCount = sets.filter((s) => s.hskLevel >= 5).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchPracticeSets(page);
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Đang đồng bộ..." : "Làm mới"}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormTitle("");
              setFormTopic(topics[0]?.topicKey || "Topic 1");
              setFormHskLevel(1);
              setIsCreateOpen(true);
            }}
            startIcon={<PlusIcon className="w-5 h-5" />}
          >
            Thêm bài học mới
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sets */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Tổng số bài luyện tập
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <DocsIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalItems}
            </span>
            <Badge variant="light" color="primary" size="sm">
              HSK 1 - 9
            </Badge>
          </div>
        </div>

        {/* Primary Sets */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK Sơ cấp (1-2)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <span className="text-lg">🌱</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {primaryCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Khởi động
            </span>
          </div>
        </div>

        {/* Intermediate Sets */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK Trung cấp (3-4)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
              <span className="text-lg">🌿</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {intermediateCount}
            </span>
            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
              Thành thạo
            </span>
          </div>
        </div>

        {/* Advanced Sets */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK Cao cấp (5-9)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-50 text-purple-500 dark:bg-purple-500/10">
              <span className="text-lg">🌳</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {advancedCount}
            </span>
            <Badge variant="light" color="warning" size="sm">
              Chuyên sâu
            </Badge>
          </div>
        </div>
      </div>

      {/* Filter and Search Container */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bài luyện tập theo tên hoặc chủ đề..."
              className="w-full h-11 pl-11 pr-4 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
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

          <div className="flex items-center gap-3">
            {/* HSK Filter */}
            <select
              value={selectedHsk}
              onChange={(e) => setSelectedHsk(e.target.value)}
              className="h-11 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="ALL">Tất cả HSK (1-9)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>

            {/* Topic Filter */}
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="h-11 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="ALL">Tất cả chủ đề</option>
              {topics.map((t) => (
                <option key={t.topicKey} value={t.topicKey}>
                  {t.titleVi || t.topicKey}
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

      {/* Practice Sets Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              Danh sách bài luyện tập
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-300">
              {totalItems} bài học
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
                  # Mã & Tên bài học
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Cấp độ HSK
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Chủ đề học thuật
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Đặc tính kỹ năng
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Số câu hỏi
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
                        Đang tải dữ liệu bài học...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sets.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-12 text-center text-gray-400 dark:text-gray-500"
                    colSpan={6}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                        Chưa có bài luyện tập nào
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setIsCreateOpen(true)}
                      >
                        Thêm bài học mới ngay
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sets.map((set) => {
                  const hskStyle = HSK_COLORS[set.hskLevel] || HSK_COLORS[1];

                  return (
                    <TableRow
                      key={set.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 dark:border-gray-800/80 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Title & Code */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {set.title}
                          </span>
                          <div className="text-xs font-mono text-gray-400">
                            Mã: #{set.id}
                          </div>
                        </div>
                      </TableCell>

                      {/* HSK Badge */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-1 rounded-lg border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}
                        >
                          HSK {set.hskLevel}
                        </span>
                      </TableCell>

                      {/* Topic Badge */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          📁 {set.topic}
                        </span>
                      </TableCell>

                      {/* Skill-specific feature */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        {skill === "LISTENING" &&
                          (set.audioUrl ? (
                            <button
                              type="button"
                              onClick={() => toggleAudio(set.audioUrl!)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                activeAudioUrl === set.audioUrl &&
                                isPlayingAudio
                                  ? "bg-sky-600 text-white shadow-sm ring-2 ring-sky-300 animate-pulse"
                                  : "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/10 dark:text-sky-300"
                              }`}
                              title={
                                activeAudioUrl === set.audioUrl &&
                                isPlayingAudio
                                  ? "Bấm để dừng"
                                  : "Bấm để nghe thử"
                              }
                            >
                              <AudioIcon className="w-3.5 h-3.5" />
                              {activeAudioUrl === set.audioUrl && isPlayingAudio
                                ? "Đang phát..."
                                : "Nghe audio"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openDetail(set.id)}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium hover:underline"
                              title="Bấm để tải file audio cho bài học này"
                            >
                              <AudioIcon className="w-3.5 h-3.5" />+ Tải audio
                            </button>
                          ))}
                        {skill === "SPEAKING" && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            🎙️ Khẩu ngữ & AI
                          </span>
                        )}
                        {skill === "READING" && (
                          <span className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium">
                            📖 Đọc hiểu văn bản
                          </span>
                        )}
                        {skill === "WRITING" && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            ✍️ Viết & Nét chữ
                          </span>
                        )}
                      </TableCell>

                      {/* Total Questions Count */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                          {set.totalQuestions} câu hỏi
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={isLoadingDetail}
                            onClick={() => openDetail(set.id)}
                            title="Xem chi tiết bài học"
                            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(set.id)}
                            title="Xóa bài học"
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
              Trang {page} / {totalPages} (Tổng {totalItems} bài)
            </span>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Create Practice Set Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        className="max-w-md p-6 sm:p-8"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Thêm bài học mới ({skill})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tạo bài luyện tập mới theo lộ trình cấp độ HSK và Chủ đề
            </p>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Tên bài học / Tiêu đề <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ví dụ: Luyện nghe hội thoại Mua sắm"
                className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Chủ đề học thuật liên kết{" "}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              >
                {topics.map((t) => (
                  <option key={t.topicKey} value={t.topicKey}>
                    {t.titleVi ? `${t.titleVi} (${t.topicKey})` : t.topicKey}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Cấp độ mục tiêu HSK <span className="text-rose-500">*</span>
              </label>
              <select
                value={formHskLevel}
                onChange={(e) => setFormHskLevel(Number(e.target.value))}
                className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    HSK {lvl}
                  </option>
                ))}
              </select>
            </div>

            {skill === "LISTENING" && (
              <div className="p-3.5 bg-sky-50/60 dark:bg-sky-500/5 rounded-xl border border-sky-200/80 dark:border-sky-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
                    <AudioIcon className="w-4 h-4 text-sky-600" />
                    File âm thanh luyện nghe (MP3 / WAV)
                  </label>
                  {formAudioUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormAudioUrl("");
                        setAudioUploadStatus(null);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 font-medium"
                    >
                      Gỡ bỏ
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={audioFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAudioUpload(file);
                  }}
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  className="hidden"
                />

                <div
                  onClick={() => audioFileInputRef.current?.click()}
                  className="border-2 border-dashed border-sky-200 hover:border-sky-400 dark:border-sky-800 dark:hover:border-sky-700 rounded-lg p-3 text-center cursor-pointer bg-white/60 dark:bg-gray-900/40 transition-colors"
                >
                  <div className="flex flex-col items-center gap-1">
                    <AudioIcon className="w-6 h-6 text-sky-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {isUploadingAudio
                        ? "Đang tải file lên..."
                        : audioUploadStatus ||
                          "Bấm để chọn tệp MP3 từ máy tính hoặc kéo thả vào đây"}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Định dạng hỗ trợ: MP3, WAV, AAC, M4A (Tối đa 100MB)
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <input
                    type="text"
                    value={formAudioUrl}
                    onChange={(e) => setFormAudioUrl(e.target.value)}
                    placeholder="Hoặc dán URL audio (ví dụ: https://.../audio.mp3)"
                    className="w-full h-9 px-3 text-xs text-gray-800 border border-gray-200 rounded-lg focus:border-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>

                {formAudioUrl && (
                  <div className="pt-1">
                    <audio
                      src={resolveFileUrl(formAudioUrl, API_BASE_URL) ?? undefined}
                      controls
                      className="w-full h-8 rounded"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isSubmittingCreate}>
              {isSubmittingCreate ? "Đang tạo..." : "Tạo bài học"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Practice Set Modal */}
      <Modal
        isOpen={!!detailSet}
        onClose={() => setDetailSet(null)}
        className="max-w-2xl p-6 sm:p-8"
      >
        {detailSet && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    HSK {detailSet.hskLevel}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {detailSet.title}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Chủ đề: <strong>{detailSet.topic}</strong> • Kỹ năng:{" "}
                  <strong>{detailSet.skill}</strong>
                </p>
              </div>
            </div>

            {/* Audio Section for LISTENING */}
            {detailSet.skill === "LISTENING" && (
              <div className="p-4 bg-sky-50/70 dark:bg-sky-500/10 rounded-2xl border border-sky-200/70 dark:border-sky-800/50 space-y-3">
                <input
                  type="file"
                  ref={detailAudioInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDetailAudioUpload(file);
                  }}
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac"
                  className="hidden"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                      <AudioIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                        File âm thanh bài học
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {detailSet.audioUrl
                          ? "File MP3 đã được tải lên cho bài luyện tập này"
                          : "Chưa có file âm thanh cho bài này"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => detailAudioInputRef.current?.click()}
                      disabled={isUpdatingDetailAudio}
                      className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 rounded-lg transition-colors"
                    >
                      {isUpdatingDetailAudio
                        ? "Đang tải lên..."
                        : detailSet.audioUrl
                          ? "Thay đổi file MP3"
                          : "📁 Tải lên file MP3"}
                    </button>
                    {detailSet.audioUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveDetailAudio}
                        disabled={isUpdatingDetailAudio}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        Gỡ audio
                      </button>
                    )}
                  </div>
                </div>

                {detailSet.audioUrl ? (
                  <div className="pt-1">
                    <audio
                      src={resolveFileUrl(detailSet.audioUrl, API_BASE_URL) ?? undefined}
                      controls
                      className="w-full h-10 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <span>
                      ⚠️ Bài học này chưa có file nghe! Bấm{" "}
                      <strong>Tải lên file MP3</strong> để bổ sung ngay.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 block">
                  Danh sách câu hỏi bài tập (
                  {detailSet.practiceSetQuestions?.length || 0} câu):
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openQuestionPicker}
                    className="text-xs"
                  >
                    + Chọn câu hỏi từ Ngân hàng
                  </Button>
                  <Link
                    href={`/questions/create?skill=${detailSet.skill}&hskLevel=${detailSet.hskLevel}`}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shadow-theme-xs"
                  >
                    + Tạo câu hỏi mới
                  </Link>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {detailSet.practiceSetQuestions &&
                detailSet.practiceSetQuestions.length > 0 ? (
                  detailSet.practiceSetQuestions.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 dark:bg-gray-800/40 dark:border-gray-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">
                          Câu {idx + 1} (Mã #{item.question?.id})
                        </span>
                        {item.question?.payload?.audioUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleAudio(item.question!.payload!.audioUrl!)
                            }
                            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-semibold"
                          >
                            <AudioIcon className="w-3.5 h-3.5" />
                            Nghe audio
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.question?.payload?.text || "Chưa có nội dung"}
                      </p>
                      {item.question?.correctAnswer?.answer && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Đáp án đúng: {item.question.correctAnswer.answer}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400 space-y-2">
                    <p>Bài học này chưa có câu hỏi nào được gán vào.</p>
                    <div className="flex justify-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={openQuestionPicker}
                      >
                        Chọn từ Ngân hàng câu hỏi
                      </Button>
                      <Link
                        href={`/questions/create?skill=${detailSet.skill}&hskLevel=${detailSet.hskLevel}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
                      >
                        + Tạo câu hỏi mới
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailSet(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Question Picker Modal */}
      <Modal
        isOpen={isQuestionPickerOpen}
        onClose={() => setIsQuestionPickerOpen(false)}
        className="max-w-2xl p-6 sm:p-8"
      >
        <div className="space-y-5">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Chọn câu hỏi từ Ngân hàng (HSK {detailSet?.hskLevel} -{" "}
                {detailSet?.skill})
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tích chọn các câu hỏi bạn muốn gán vào bài học &quot;
                {detailSet?.title}&quot;
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              Đã chọn: {selectedQuestionIds.length} câu
            </span>
          </div>

          {isLoadingPickerQuestions ? (
            <div className="py-12 text-center text-sm text-gray-400">
              Đang tải danh sách câu hỏi...
            </div>
          ) : availableQuestions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chưa có câu hỏi nào trong ngân hàng phù hợp với HSK{" "}
                {detailSet?.hskLevel} và kỹ năng {detailSet?.skill}.
              </p>
              <Link
                href={`/questions/create?skill=${detailSet?.skill}&hskLevel=${detailSet?.hskLevel}`}
                className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
              >
                + Đi tới Tạo câu hỏi mới
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Danh sách ({availableQuestions.length} câu hỏi):</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQuestionIds(
                        availableQuestions.map((q) => q.id),
                      )
                    }
                    className="text-brand-600 hover:underline font-medium"
                  >
                    Chọn tất cả
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIds([])}
                    className="text-rose-500 hover:underline font-medium"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 border border-gray-100 dark:border-gray-800 rounded-xl p-2">
                {availableQuestions.map((q) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  return (
                    <label
                      key={q.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-brand-50/50 border-brand-200 dark:bg-brand-500/10 dark:border-brand-800"
                          : "bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-900/40 dark:border-gray-800 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleQuestionSelect(q.id)}
                        className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-500">
                            #{q.id}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {q.type}
                          </span>
                          {q.payload?.audioUrl && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 flex items-center gap-1">
                              <AudioIcon className="w-3 h-3" /> Audio
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                          {q.payload?.text || "Chưa có nội dung câu hỏi"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQuestionPickerOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSavingQuestions}
              onClick={handleSaveQuestionsToSet}
            >
              {isSavingQuestions
                ? "Đang lưu..."
                : `Lưu (${selectedQuestionIds.length}) câu hỏi vào bài`}
            </Button>
          </div>
        </div>
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
              Xác nhận xóa bài luyện tập #{deleteTargetId}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Hành động này sẽ xóa bài học và gỡ liên kết với các câu hỏi trong
              ngân hàng.
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
