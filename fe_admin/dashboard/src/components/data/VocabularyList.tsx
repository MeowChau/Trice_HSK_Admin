"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import {
  PlusIcon,
  TrashBinIcon,
  PencilIcon,
  FolderIcon,
  CheckCircleIcon,
} from "@/icons";
import {
  TEXTBOOK_LESSONS,
  getLessonsByHsk,
  getLessonByTopicKey,
} from "@/constants/textbookLessons";

export interface VocabItem {
  id: number;
  hanzi: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
  topic?: string | null;
  createdAt?: string;
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

export default function VocabularyList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const paramHsk = searchParams.get("hsk");
  const paramTopic = searchParams.get("topic");

  // Filters
  const [selectedHsk, setSelectedHsk] = useState<number>(
    paramHsk ? Number(paramHsk) : 1
  );
  const [selectedTopic, setSelectedTopic] = useState<string>(
    paramTopic || "ALL"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data state
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchTargetTopic, setBatchTargetTopic] = useState("");
  const [isBatchAssigning, setIsBatchAssigning] = useState(false);

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT">("CREATE");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formHanzi, setFormHanzi] = useState("");
  const [formPinyin, setFormPinyin] = useState("");
  const [formMeaning, setFormMeaning] = useState("");
  const [formHskLevel, setFormHskLevel] = useState<number>(1);
  const [formTopic, setFormTopic] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Lessons list for the currently selected HSK
  const currentHskLessons = useMemo(() => {
    return getLessonsByHsk(selectedHsk);
  }, [selectedHsk]);

  // Lessons list for the modal form HSK
  const formHskLessons = useMemo(() => {
    return getLessonsByHsk(formHskLevel);
  }, [formHskLevel]);

  // Fetch vocabulary list
  const fetchVocabularies = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let query = `vocabulary?page=${page}&limit=${limit}&hskLevel=${selectedHsk}`;
      if (selectedTopic && selectedTopic !== "ALL") {
        query += `&topic=${encodeURIComponent(selectedTopic)}`;
      }
      if (debouncedSearch.trim()) {
        query += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }

      const res = await apiFetch(query);
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const json = await res.json();
      setVocabList(json.data || []);
      setTotalCount(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tải danh sách từ vựng.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, selectedHsk, selectedTopic, debouncedSearch]);

  useEffect(() => {
    fetchVocabularies();
  }, [fetchVocabularies]);

  // Handle HSK change
  const handleHskChange = (lvl: number) => {
    setSelectedHsk(lvl);
    setSelectedTopic("ALL");
    setPage(1);
    setSelectedIds([]);
  };

  // Toggle selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(vocabList.map((v) => v.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Batch assign to selected topic
  const handleBatchAssign = async () => {
    if (selectedIds.length === 0 || !batchTargetTopic) return;
    setIsBatchAssigning(true);
    try {
      const topicValue = batchTargetTopic === "CLEAR" ? null : batchTargetTopic;
      const res = await apiFetch("vocabulary/batch-assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vocabIds: selectedIds,
          topic: topicValue,
        }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      setSelectedIds([]);
      setBatchTargetTopic("");
      await fetchVocabularies();
    } catch (err: any) {
      alert(err.message || "Không thể đẩy từ vựng vào bài học.");
    } finally {
      setIsBatchAssigning(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalMode("CREATE");
    setEditingId(null);
    setFormHanzi("");
    setFormPinyin("");
    setFormMeaning("");
    setFormHskLevel(selectedHsk);
    setFormTopic(selectedTopic !== "ALL" && selectedTopic !== "UNASSIGNED" ? selectedTopic : "");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (v: VocabItem) => {
    setModalMode("EDIT");
    setEditingId(v.id);
    setFormHanzi(v.hanzi);
    setFormPinyin(v.pinyin);
    setFormMeaning(v.meaning);
    setFormHskLevel(v.hskLevel);
    setFormTopic(v.topic || "");
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSaveVocab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHanzi.trim() || !formPinyin.trim() || !formMeaning.trim()) {
      alert("Vui lòng nhập đầy đủ Chữ Hán, Pinyin và Ý nghĩa.");
      return;
    }
    setIsSaving(true);
    try {
      if (modalMode === "CREATE") {
        const res = await apiFetch("vocabulary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hanzi: formHanzi.trim(),
            pinyin: formPinyin.trim(),
            meaning: formMeaning.trim(),
            hskLevel: formHskLevel,
            topic: formTopic ? formTopic : null,
          }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
      } else {
        const res = await apiFetch(`vocabulary/${editingId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hanzi: formHanzi.trim(),
            pinyin: formPinyin.trim(),
            meaning: formMeaning.trim(),
            hskLevel: formHskLevel,
            topic: formTopic ? formTopic : null,
          }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
      }
      setIsModalOpen(false);
      await fetchVocabularies();
    } catch (err: any) {
      alert(err.message || "Lỗi lưu từ vựng");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete vocab
  const handleDeleteVocab = async (id: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa từ vựng này không?")) return;
    try {
      const res = await apiFetch(`vocabulary/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readApiError(res));
      await fetchVocabularies();
    } catch (err: any) {
      alert(err.message || "Không thể xóa từ vựng.");
    }
  };

  const isAllSelected = vocabList.length > 0 && selectedIds.length === vocabList.length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-brand-50 text-brand-600 rounded-xl dark:bg-brand-500/10 dark:text-brand-400">
              <span className="text-xl">📖</span>
            </span>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Kho từ vựng HSK & Bám sát giáo trình
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tra cứu từ vựng theo từng cấp độ HSK 1 - 9 và liên kết bám sát theo từng bài học trong sách giáo trình & bài tập.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/data/topics">
            <Button variant="outline" size="sm" startIcon={<FolderIcon className="w-4 h-4" />}>
              Danh mục bài học
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            startIcon={<PlusIcon className="w-5 h-5" />}
          >
            Thêm từ vựng mới
          </Button>
        </div>
      </div>

      {/* Level Selection Tabs (HSK 1 - 9) */}
      <div className="p-2 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-gray-400 px-3 uppercase tracking-wider shrink-0">
            Cấp độ HSK:
          </span>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => {
            const isSelected = selectedHsk === lvl;
            const style = HSK_COLORS[lvl] || HSK_COLORS[1];
            return (
              <button
                key={lvl}
                onClick={() => handleHskChange(lvl)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  isSelected
                    ? "bg-brand-500 text-white shadow-sm dark:bg-brand-600"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                HSK {lvl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search box */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo chữ Hán (你好), Pinyin (ni hao), hoặc nghĩa tiếng Việt..."
              className="w-full h-11 pl-11 pr-4 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder-gray-400"
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

          {/* Topic / Lesson Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[260px]">
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setPage(1);
                }}
                className="w-full h-11 px-3.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="ALL">📚 Tất cả bài học (HSK {selectedHsk})</option>
                <option value="UNASSIGNED">⚪ Từ vựng chưa gán bài học (Kho chung)</option>
                <optgroup label={`Danh sách bài học giáo trình HSK ${selectedHsk}`}>
                  {currentHskLessons.map((l) => (
                    <option key={l.topicKey} value={l.topicKey}>
                      {l.titleVi} ({l.titleCn})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedTopic("ALL");
                setPage(1);
              }}
            >
              Đặt lại
            </Button>
          </div>
        </div>

        {/* Batch Action Toolbar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-xl dark:bg-brand-500/10 dark:border-brand-800/60 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
              <span className="text-sm font-semibold text-brand-900 dark:text-brand-300">
                Đã chọn <strong>{selectedIds.length}</strong> từ vựng
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 dark:text-gray-400">Đẩy vào bài học:</span>
              <select
                value={batchTargetTopic}
                onChange={(e) => setBatchTargetTopic(e.target.value)}
                className="h-9 px-3 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
              >
                <option value="">-- Chọn bài học đích --</option>
                {currentHskLessons.map((l) => (
                  <option key={l.topicKey} value={l.topicKey}>
                    {l.titleVi} ({l.titleCn})
                  </option>
                ))}
                <option value="CLEAR">⚪ Gỡ khỏi bài học (về kho chung)</option>
              </select>

              <Button
                size="sm"
                disabled={!batchTargetTopic || isBatchAssigning}
                onClick={handleBatchAssign}
              >
                {isBatchAssigning ? "Đang xử lý..." : "Xác nhận gán bài học"}
              </Button>

              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white px-2 py-1"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vocabulary Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              Danh sách từ vựng HSK {selectedHsk}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-300">
              Tổng {totalCount} từ
            </span>
          </div>
          <span className="text-xs text-gray-400">
            Trang {page} / {totalPages || 1}
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
                <TableCell isHeader className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Chữ Hán & Phiên âm
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Ý nghĩa tiếng Việt
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Cấp độ
                </TableCell>
                <TableCell isHeader className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  Bài học giáo trình bám sát
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
                      <span className="text-sm">Đang tải danh sách từ vựng...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : vocabList.length === 0 ? (
                <TableRow>
                  <TableCell className="px-5 py-12 text-center text-gray-400 dark:text-gray-500" {...({ colSpan: 6 } as any)}>
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">📭</span>
                      <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                        Không tìm thấy từ vựng nào trong danh mục này
                      </p>
                      <Button size="sm" onClick={handleOpenCreateModal}>
                        Thêm từ vựng đầu tiên
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                vocabList.map((v) => {
                  const isChecked = selectedIds.includes(v.id);
                  const hskStyle = HSK_COLORS[v.hskLevel] || HSK_COLORS[1];
                  const matchedLesson = v.topic ? getLessonByTopicKey(v.topic) : undefined;

                  return (
                    <TableRow
                      key={v.id}
                      className={`border-b border-gray-100 hover:bg-gray-50/60 dark:border-gray-800/80 dark:hover:bg-gray-800/30 transition-colors ${
                        isChecked ? "bg-brand-50/30 dark:bg-brand-500/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <TableCell className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(v.id)}
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                        />
                      </TableCell>

                      {/* Hanzi & Pinyin */}
                      <TableCell className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold font-sans text-gray-900 dark:text-white">
                            {v.hanzi}
                          </span>
                          <div>
                            <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 block">
                              {v.pinyin}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ID: #{v.id}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Meaning */}
                      <TableCell className="px-5 py-3.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {v.meaning}
                        </span>
                      </TableCell>

                      {/* HSK Level */}
                      <TableCell className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-0.5 rounded border ${hskStyle.bg} ${hskStyle.text} ${hskStyle.border}`}>
                          HSK {v.hskLevel}
                        </span>
                      </TableCell>

                      {/* Topic / Lesson */}
                      <TableCell className="px-5 py-3.5 whitespace-nowrap">
                        {v.topic ? (
                          <div className="flex items-center gap-2">
                            <span className="text-base">{matchedLesson?.icon || "📖"}</span>
                            <div>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                                {matchedLesson ? matchedLesson.titleVi : v.topic}
                              </span>
                              {matchedLesson && (
                                <span className="text-[10px] font-mono text-gray-400">
                                  {matchedLesson.titleCn} ({v.topic})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs font-normal text-gray-400 italic">
                            Chưa gán bài học (Kho chung)
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(v)}
                            title="Sửa từ vựng"
                            className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 transition"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteVocab(v.id)}
                            title="Xóa từ vựng"
                            className="p-1.5 text-gray-500 rounded-lg hover:bg-rose-50 hover:text-rose-500 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 transition"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Hiển thị {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} trong {totalCount} từ vựng
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trang trước
              </Button>
              <span className="px-3 py-1 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg dark:bg-gray-800 dark:text-gray-300">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Trang sau
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Vocabulary Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-lg p-6 sm:p-8"
      >
        <form onSubmit={handleSaveVocab} className="space-y-4">
          <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {modalMode === "CREATE" ? "Thêm từ vựng mới" : "Chỉnh sửa từ vựng"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Quản lý chi tiết từ vựng và bài học giáo trình liên kết
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Chữ Hán (Tiếng Trung) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formHanzi}
                  onChange={(e) => setFormHanzi(e.target.value)}
                  placeholder="Ví dụ: 老师"
                  className="w-full h-10 px-3.5 text-base font-bold text-gray-900 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Phiên âm Pinyin <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formPinyin}
                  onChange={(e) => setFormPinyin(e.target.value)}
                  placeholder="Ví dụ: lǎoshī"
                  className="w-full h-10 px-3.5 text-sm font-mono border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
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
                value={formMeaning}
                onChange={(e) => setFormMeaning(e.target.value)}
                placeholder="Ví dụ: Thầy giáo, cô giáo, giáo viên"
                className="w-full h-10 px-3.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Cấp độ HSK <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formHskLevel}
                  onChange={(e) => setFormHskLevel(Number(e.target.value))}
                  className="w-full h-10 px-3.5 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      HSK {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Bài học bám sát giáo trình
                </label>
                <select
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="">⚪ Chưa gán (Kho chung HSK {formHskLevel})</option>
                  {formHskLessons.map((l) => (
                    <option key={l.topicKey} value={l.topicKey}>
                      {l.titleVi} ({l.titleCn})
                    </option>
                  ))}
                </select>
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
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : modalMode === "CREATE" ? "Tạo từ vựng" : "Lưu thay đổi"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
