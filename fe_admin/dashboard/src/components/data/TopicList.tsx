"use client";
import { HSK_COLORS } from "@/constants/hsk";
import { errorMessage } from "@/lib/error-message";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { PlusIcon, EyeIcon, FolderIcon, PencilIcon } from "@/icons";

export interface TopicItem {
  id: string;
  topicKey: string;
  titleVi: string;
  titleCn: string;
  pinyin: string;
  icon: string;
  hskLevel: number;
  vocabularyCount: number;
  totalSets: number;
  totalQuestions: number;
  listeningCount: number;
  speakingCount: number;
  readingCount: number;
  writingCount: number;
}

export interface VocabItem {
  id: number;
  hanzi: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
  topic?: string | null;
}

export default function TopicList() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHsk, setSelectedHsk] = useState<string>("ALL");

  // Create / Edit Topic Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [formTopicKey, setFormTopicKey] = useState("");
  const [formTitleVi, setFormTitleVi] = useState("");
  const [formTitleCn, setFormTitleCn] = useState("");
  const [formPinyin, setFormPinyin] = useState("");
  const [formIcon, setFormIcon] = useState("📚");
  const [formHskLevel, setFormHskLevel] = useState(1);

  // Detail Modal
  const [detailTopic, setDetailTopic] = useState<TopicItem | null>(null);

  // Vocab Management Modal for a Topic
  const [vocabManageTopic, setVocabManageTopic] = useState<TopicItem | null>(
    null,
  );
  const [vocabTab, setVocabTab] = useState<"current" | "assign" | "create">(
    "current",
  );
  const [topicVocabs, setTopicVocabs] = useState<VocabItem[]>([]);
  const [isLoadingTopicVocabs, setIsLoadingTopicVocabs] = useState(false);

  // Assign tab state
  const [candidateVocabs, setCandidateVocabs] = useState<VocabItem[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateOnlyUnassigned, setCandidateOnlyUnassigned] = useState(true);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>(
    [],
  );
  const [isAssigning, setIsAssigning] = useState(false);

  // Quick create vocab in topic
  const [quickHanzi, setQuickHanzi] = useState("");
  const [quickPinyin, setQuickPinyin] = useState("");
  const [quickMeaning, setQuickMeaning] = useState("");
  const [isCreatingVocab, setIsCreatingVocab] = useState(false);

  const fetchTopics = async () => {
    try {
      setErrorMsg(null);
      const res = await apiFetch("practice-sets/topics");
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = await res.json();
      setTopics(data || []);
    } catch (err) {
      setErrorMsg(errorMessage(err, "") || "Không thể tải danh sách chủ đề.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchHsk =
        selectedHsk === "ALL" || t.hskLevel === Number(selectedHsk);
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        t.titleVi.toLowerCase().includes(term) ||
        t.titleCn.toLowerCase().includes(term) ||
        t.pinyin.toLowerCase().includes(term) ||
        t.topicKey.toLowerCase().includes(term);
      return matchHsk && matchSearch;
    });
  }, [topics, selectedHsk, searchTerm]);

  // KPI stats
  const totalTopics = topics.length;

  const hsk1Topics = topics.filter((t) => t.hskLevel === 1).length;
  const hsk2Topics = topics.filter((t) => t.hskLevel === 2).length;
  const hsk3Topics = topics.filter((t) => t.hskLevel === 3).length;

  const handleOpenCreateModal = () => {
    setModalMode("CREATE");
    setFormTopicKey(`HSK1-L${String(topics.length + 1).padStart(2, "0")}`);
    setFormTitleVi("");
    setFormTitleCn("");
    setFormPinyin("");
    setFormIcon("📖");
    setFormHskLevel(1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: TopicItem) => {
    setModalMode("EDIT");
    setFormTopicKey(t.topicKey);
    setFormTitleVi(t.titleVi);
    setFormTitleCn(t.titleCn);
    setFormPinyin(t.pinyin);
    setFormIcon(t.icon);
    setFormHskLevel(t.hskLevel);
    setIsModalOpen(true);
  };

  const handleSaveTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitleVi.trim()) {
      alert("Vui lòng nhập tên chủ đề tiếng Việt.");
      return;
    }

    if (modalMode === "CREATE") {
      const newTopic: TopicItem = {
        id: formTopicKey,
        topicKey: formTopicKey,
        titleVi: formTitleVi.trim(),
        titleCn: formTitleCn.trim(),
        pinyin: formPinyin.trim(),
        icon: formIcon.trim() || "📁",
        hskLevel: Number(formHskLevel),
        vocabularyCount: 0,
        totalSets: 0,
        totalQuestions: 0,
        listeningCount: 0,
        speakingCount: 0,
        readingCount: 0,
        writingCount: 0,
      };
      setTopics([newTopic, ...topics]);
    } else {
      setTopics(
        topics.map((t) =>
          t.topicKey === formTopicKey
            ? {
                ...t,
                titleVi: formTitleVi.trim(),
                titleCn: formTitleCn.trim(),
                pinyin: formPinyin.trim(),
                icon: formIcon.trim(),
                hskLevel: Number(formHskLevel),
              }
            : t,
        ),
      );
    }
    setIsModalOpen(false);
  };

  // Open Vocab Management Modal
  const handleOpenVocabModal = async (t: TopicItem) => {
    setVocabManageTopic(t);
    setVocabTab("current");
    setSelectedCandidateIds([]);
    await loadTopicVocabs(t.topicKey);
  };

  const loadTopicVocabs = async (topicKey: string) => {
    setIsLoadingTopicVocabs(true);
    try {
      const res = await apiFetch(
        `vocabulary?topic=${encodeURIComponent(topicKey)}&limit=100`,
      );
      if (res.ok) {
        const json = await res.json();
        setTopicVocabs(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTopicVocabs(false);
    }
  };

  // Load candidate vocabs for assignment
  const loadCandidateVocabs = async (
    hskLevel: number,
    onlyUnassigned: boolean,
    search: string,
  ) => {
    try {
      let url = `vocabulary?hskLevel=${hskLevel}&limit=50`;
      if (onlyUnassigned) {
        url += `&topic=UNASSIGNED`;
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setCandidateVocabs(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (vocabManageTopic && vocabTab === "assign") {
      loadCandidateVocabs(
        vocabManageTopic.hskLevel,
        candidateOnlyUnassigned,
        candidateSearch,
      );
    }
  }, [vocabManageTopic, vocabTab, candidateOnlyUnassigned, candidateSearch]);

  const handleSearchCandidates = () => {
    if (vocabManageTopic) {
      loadCandidateVocabs(
        vocabManageTopic.hskLevel,
        candidateOnlyUnassigned,
        candidateSearch,
      );
    }
  };

  // Batch assign selected vocabs to this topic
  const handleBatchAssignToTopic = async () => {
    if (!vocabManageTopic || selectedCandidateIds.length === 0) return;
    setIsAssigning(true);
    try {
      const res = await apiFetch("vocabulary/batch-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vocabIds: selectedCandidateIds,
          topic: vocabManageTopic.topicKey,
        }),
      });
      if (res.ok) {
        setSelectedCandidateIds([]);
        await loadTopicVocabs(vocabManageTopic.topicKey);
        await fetchTopics();
        setVocabTab("current");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAssigning(false);
    }
  };

  // Unassign single vocab from topic
  const handleUnassignVocab = async (vocabId: number) => {
    if (!vocabManageTopic) return;
    try {
      const res = await apiFetch(`vocabulary/${vocabId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: null }),
      });
      if (res.ok) {
        setTopicVocabs(topicVocabs.filter((v) => v.id !== vocabId));
        await fetchTopics();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick create a new vocab in topic
  const handleQuickCreateVocab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vocabManageTopic || !quickHanzi.trim() || !quickMeaning.trim()) return;
    setIsCreatingVocab(true);
    try {
      const res = await apiFetch("vocabulary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hanzi: quickHanzi.trim(),
          pinyin: quickPinyin.trim(),
          meaning: quickMeaning.trim(),
          hskLevel: vocabManageTopic.hskLevel,
          topic: vocabManageTopic.topicKey,
        }),
      });
      if (res.ok) {
        setQuickHanzi("");
        setQuickPinyin("");
        setQuickMeaning("");
        await loadTopicVocabs(vocabManageTopic.topicKey);
        await fetchTopics();
        setVocabTab("current");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingVocab(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl dark:bg-brand-500/10 dark:text-brand-400">
              <FolderIcon className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Chủ đề bài học theo giáo trình HSK
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Khung bài học chuẩn bám sát sách bài tập HSK 1 - 3 (HSK 3.0). Quản
            lý bài tập 4 kỹ năng và phân bổ từ vựng theo từng bài.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/data/vocabulary">
            <Button
              variant="outline"
              size="sm"
              startIcon={<span className="text-base">📖</span>}
            >
              Kho từ vựng toàn diện
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchTopics();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Đang đồng bộ..." : "Làm mới"}
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            startIcon={<PlusIcon className="w-5 h-5" />}
          >
            Thêm bài học mới
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Topics */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Tổng số bài học
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <FolderIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalTopics}{" "}
              <span className="text-sm font-normal text-gray-400">bài</span>
            </span>
            <Badge variant="light" color="primary" size="sm">
              Giáo trình chuẩn
            </Badge>
          </div>
        </div>

        {/* HSK 1 Lessons */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK 1 (15 Bài học)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
              <span className="text-lg">👋</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {hsk1Topics} / 15
            </span>
            <span className="text-xs text-gray-500">Nhập môn HSK</span>
          </div>
        </div>

        {/* HSK 2 Lessons */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK 2 (15 Bài học)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-500 dark:bg-teal-500/10">
              <span className="text-lg">🚕</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {hsk2Topics} / 15
            </span>
            <span className="text-xs text-gray-500">Sách bài tập mới</span>
          </div>
        </div>

        {/* HSK 3 Lessons */}
        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              HSK 3 (18 Bài học)
            </span>
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-500 dark:bg-sky-500/10">
              <span className="text-lg">🛫</span>
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {hsk3Topics} / 18
            </span>
            <span className="text-xs text-gray-500">Trung cấp HSK 3.0</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tiêu đề bài học (Ví dụ: Xin chào, 你好, HSK1-L01)..."
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
            <select
              value={selectedHsk}
              onChange={(e) => setSelectedHsk(e.target.value)}
              className="h-11 px-3.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="ALL">Tất cả cấp độ (HSK 1 - 9)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                <option key={lvl} value={lvl}>
                  HSK {lvl}
                </option>
              ))}
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedHsk("ALL");
              }}
            >
              Đặt lại
            </Button>
          </div>
        </div>
      </div>

      {/* Topics Table View */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              Danh mục bài học giáo trình
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-brand-50 text-brand-700 rounded-full dark:bg-brand-500/10 dark:text-brand-300">
              {filteredTopics.length} bài học
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            * Bấm vào nút &quot;Đẩy từ vựng&quot; để gán từ vựng từ kho HSK vào
            bài học này
          </span>
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
                  Bài học & Cấp độ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Tiêu đề sách giáo trình (Hán tự & Pinyin)
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Từ vựng bài học
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400"
                >
                  Bài tập 4 kỹ năng
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
                    colSpan={5}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">
                        Đang tải danh mục bài học...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTopics.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-5 py-12 text-center text-gray-400 dark:text-gray-500"
                    colSpan={5}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FolderIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                        Không tìm thấy bài học nào phù hợp
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTopics.map((t) => {
                  const hskStyle = HSK_COLORS[t.hskLevel] || HSK_COLORS[1];

                  return (
                    <TableRow
                      key={t.id}
                      className="border-b border-gray-100 hover:bg-gray-50/60 dark:border-gray-800/80 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      {/* Topic Title Vi & Badge */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{t.icon || "📖"}</span>
                          <div className="space-y-1">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {t.titleVi}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center justify-center font-bold text-[10px] px-2 py-0.5 rounded border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}
                              >
                                HSK {t.hskLevel}
                              </span>
                              <span className="text-xs font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                {t.topicKey}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Chinese & Pinyin */}
                      <TableCell className="px-5 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <span className="text-base font-bold text-gray-900 dark:text-white font-sans">
                            {t.titleCn || "-"}
                          </span>
                          {t.pinyin && (
                            <p className="text-xs font-mono text-brand-600 dark:text-brand-400 font-medium">
                              {t.pinyin}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Vocabulary Count & Quick View */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenVocabModal(t)}
                          title="Bấm để xem và quản lý từ vựng bài học này"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 bg-brand-50/70 text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-300 font-medium text-xs transition"
                        >
                          <span>📚</span>
                          <strong>{t.vocabularyCount || 0} từ</strong>
                        </button>
                      </TableCell>

                      {/* 4 Skills Distribution Badges */}
                      <TableCell className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/data/listening?topic=${encodeURIComponent(t.topicKey)}`}
                          >
                            <span
                              title="Bài nghe"
                              className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                t.listeningCount > 0
                                  ? "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300"
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                              }`}
                            >
                              🎧 {t.listeningCount}
                            </span>
                          </Link>
                          <Link
                            href={`/data/speaking?topic=${encodeURIComponent(t.topicKey)}`}
                          >
                            <span
                              title="Bài nói (HSKK)"
                              className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                t.speakingCount > 0
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                              }`}
                            >
                              🎙️ {t.speakingCount}
                            </span>
                          </Link>
                          <Link
                            href={`/data/reading?topic=${encodeURIComponent(t.topicKey)}`}
                          >
                            <span
                              title="Bài đọc hiểu"
                              className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                t.readingCount > 0
                                  ? "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300"
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                              }`}
                            >
                              📖 {t.readingCount}
                            </span>
                          </Link>
                          <Link
                            href={`/data/writing?topic=${encodeURIComponent(t.topicKey)}`}
                          >
                            <span
                              title="Bài viết"
                              className={`px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                                t.writingCount > 0
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                              }`}
                            >
                              ✍️ {t.writingCount}
                            </span>
                          </Link>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenVocabModal(t)}
                            className="text-xs h-8 px-2.5 bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-800"
                          >
                            + Đẩy từ vựng
                          </Button>
                          <button
                            onClick={() => setDetailTopic(t)}
                            title="Xem chi tiết bài học"
                            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(t)}
                            title="Sửa bài học"
                            className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition-colors"
                          >
                            <PencilIcon className="w-4 h-4" />
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
      </div>

      {/* Vocabulary Management Modal for Topic */}
      <Modal
        isOpen={!!vocabManageTopic}
        onClose={() => setVocabManageTopic(null)}
        className="max-w-3xl p-6 sm:p-8"
      >
        {vocabManageTopic && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-gray-100 dark:border-gray-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{vocabManageTopic.icon}</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {vocabManageTopic.titleVi}
                  </h3>
                  <Badge variant="light" color="primary" size="sm">
                    HSK {vocabManageTopic.hskLevel}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {vocabManageTopic.titleCn} ({vocabManageTopic.pinyin}) • Mã
                  bài: {vocabManageTopic.topicKey}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    router.push(
                      `/data/vocabulary?hsk=${vocabManageTopic.hskLevel}&topic=${vocabManageTopic.topicKey}`,
                    );
                    setVocabManageTopic(null);
                  }}
                >
                  Xem ở trang Từ vựng ↗
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setVocabTab("current")}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  vocabTab === "current"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
                }`}
              >
                Từ vựng trong bài ({topicVocabs.length})
              </button>
              <button
                onClick={() => setVocabTab("assign")}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  vocabTab === "assign"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
                }`}
              >
                + Đẩy từ vựng từ kho HSK {vocabManageTopic.hskLevel}
              </button>
              <button
                onClick={() => setVocabTab("create")}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  vocabTab === "create"
                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400"
                }`}
              >
                + Tạo từ mới trực tiếp
              </button>
            </div>

            {/* Tab 1: Current Vocabs */}
            {vocabTab === "current" && (
              <div className="space-y-3">
                {isLoadingTopicVocabs ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    Đang tải danh sách từ vựng...
                  </div>
                ) : topicVocabs.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Bài học này hiện chưa có từ vựng nào được gán.
                    </p>
                    <Button size="sm" onClick={() => setVocabTab("assign")}>
                      Đẩy từ vựng từ kho HSK vào bài học này
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                    {topicVocabs.map((v) => (
                      <div
                        key={v.id}
                        className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold font-sans text-gray-900 dark:text-white">
                            {v.hanzi}
                          </span>
                          <div>
                            <span className="text-xs font-mono font-medium text-brand-600 dark:text-brand-400 block">
                              {v.pinyin}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              {v.meaning}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnassignVocab(v.id)}
                          title="Gỡ từ vựng khỏi bài này (chuyển về kho chung)"
                          className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg dark:text-rose-400 dark:hover:bg-rose-500/10 transition"
                        >
                          Gỡ khỏi bài
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Assign from HSK vocabulary bank */}
            {vocabTab === "assign" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSearchCandidates()
                    }
                    placeholder="Tìm theo chữ Hán, Pinyin, nghĩa..."
                    className="flex-1 h-10 px-3.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={candidateOnlyUnassigned}
                        onChange={(e) =>
                          setCandidateOnlyUnassigned(e.target.checked)
                        }
                        className="rounded text-brand-600"
                      />
                      Chỉ từ chưa gán
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSearchCandidates}
                    >
                      Tìm kiếm
                    </Button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                  {candidateVocabs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      Không tìm thấy từ vựng nào trong kho HSK{" "}
                      {vocabManageTopic.hskLevel}
                    </div>
                  ) : (
                    candidateVocabs.map((v) => {
                      const isChecked = selectedCandidateIds.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCandidateIds([
                                    ...selectedCandidateIds,
                                    v.id,
                                  ]);
                                } else {
                                  setSelectedCandidateIds(
                                    selectedCandidateIds.filter(
                                      (id) => id !== v.id,
                                    ),
                                  );
                                }
                              }}
                              className="w-4 h-4 rounded text-brand-600"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold font-sans text-gray-900 dark:text-white">
                                  {v.hanzi}
                                </span>
                                <span className="text-xs font-mono text-brand-600 dark:text-brand-400">
                                  {v.pinyin}
                                </span>
                              </div>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {v.meaning}
                              </span>
                            </div>
                          </div>
                          {v.topic && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded dark:bg-gray-800">
                              Đang ở: {v.topic}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">
                    Đã chọn: <strong>{selectedCandidateIds.length}</strong> từ
                    vựng
                  </span>
                  <Button
                    size="sm"
                    disabled={selectedCandidateIds.length === 0 || isAssigning}
                    onClick={handleBatchAssignToTopic}
                  >
                    {isAssigning
                      ? "Đang lưu..."
                      : `Đẩy ${selectedCandidateIds.length} từ vào bài học này`}
                  </Button>
                </div>
              </div>
            )}

            {/* Tab 3: Quick create */}
            {vocabTab === "create" && (
              <form onSubmit={handleQuickCreateVocab} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Chữ Hán (Tiếng Trung){" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quickHanzi}
                      onChange={(e) => setQuickHanzi(e.target.value)}
                      placeholder="Ví dụ: 机场"
                      className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Phiên âm Pinyin <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={quickPinyin}
                      onChange={(e) => setQuickPinyin(e.target.value)}
                      placeholder="Ví dụ: jīchǎng"
                      className="w-full h-10 px-3 text-sm font-mono border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ý nghĩa tiếng Việt <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={quickMeaning}
                    onChange={(e) => setQuickMeaning(e.target.value)}
                    placeholder="Ví dụ: Sân bay, phi trường"
                    className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" disabled={isCreatingVocab}>
                    {isCreatingVocab ? "Đang thêm..." : "Thêm vào bài học"}
                  </Button>
                </div>
              </form>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVocabManageTopic(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Topic Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-lg p-6 sm:p-8"
      >
        <form onSubmit={handleSaveTopic} className="space-y-5">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {modalMode === "CREATE"
                ? "Thêm bài học giáo trình mới"
                : `Sửa bài học: ${formTopicKey}`}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Bài học bám sát nội dung sách bài tập và phân loại từ vựng, bài
              tập kỹ năng
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Mã bài học (Topic Key) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formTopicKey}
                onChange={(e) => setFormTopicKey(e.target.value)}
                disabled={modalMode === "EDIT"}
                placeholder="Ví dụ: HSK1-L16 hoặc HSK2-L16"
                className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Tên bài học tiếng Việt <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formTitleVi}
                onChange={(e) => setFormTitleVi(e.target.value)}
                placeholder="Ví dụ: Bài 16: Ôn tập tổng hợp"
                className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Tên chữ Hán (Tiêu đề sách)
                </label>
                <input
                  type="text"
                  value={formTitleCn}
                  onChange={(e) => setFormTitleCn(e.target.value)}
                  placeholder="Ví dụ: 综合复习"
                  className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Phiên âm Pinyin
                </label>
                <input
                  type="text"
                  value={formPinyin}
                  onChange={(e) => setFormPinyin(e.target.value)}
                  placeholder="Ví dụ: Zōnghé fùxí"
                  className="w-full h-11 px-4 text-sm font-mono text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Cấp độ HSK <span className="text-rose-500">*</span>
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

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Biểu tượng Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="Ví dụ: 🛍️, ✈️, 🏮"
                  className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm">
              {modalMode === "CREATE" ? "Tạo bài học" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Topic Modal */}
      <Modal
        isOpen={!!detailTopic}
        onClose={() => setDetailTopic(null)}
        className="max-w-md p-6"
      >
        {detailTopic && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <span className="text-4xl inline-block">{detailTopic.icon}</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {detailTopic.titleVi}
              </h3>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {detailTopic.titleCn}{" "}
                {detailTopic.pinyin ? `(${detailTopic.pinyin})` : ""}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Badge variant="light" color="primary" size="sm">
                  HSK {detailTopic.hskLevel}
                </Badge>
                <span className="text-xs font-mono text-gray-400">
                  {detailTopic.topicKey}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 dark:bg-gray-800/40 dark:border-gray-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Từ vựng bài học:
                </span>
                <span className="text-sm font-bold text-brand-600 dark:text-brand-400">
                  {detailTopic.vocabularyCount || 0} từ
                </span>
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block pt-1">
                Phân bổ bài tập 4 kỹ năng:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                  <span>🎧 Nghe hiểu:</span>
                  <strong>{detailTopic.listeningCount} bài</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                  <span>🎙️ Nói (HSKK):</span>
                  <strong>{detailTopic.speakingCount} bài</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                  <span>📖 Đọc hiểu:</span>
                  <strong>{detailTopic.readingCount} bài</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between">
                  <span>✍️ Viết:</span>
                  <strong>{detailTopic.writingCount} bài</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                size="sm"
                onClick={() => {
                  const t = detailTopic;
                  setDetailTopic(null);
                  handleOpenVocabModal(t);
                }}
              >
                Quản lý từ vựng
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailTopic(null)}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
