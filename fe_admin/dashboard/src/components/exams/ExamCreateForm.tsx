"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, readApiError } from "@/lib/api";
import Button from "../ui/button/Button";
import Badge from "../ui/badge/Badge";
import { Modal } from "../ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  ChevronLeftIcon,
  PlusIcon,
  TrashBinIcon,
  CheckCircleIcon,
  DocsIcon,
  AudioIcon,
  FileIcon,
  EyeIcon,
} from "@/icons";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface QuestionOption {
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
  };
  correctAnswer?: {
    answer?: string;
  };
}

interface ExamSectionDraft {
  tempId: string;
  title: string;
  order: number;
  skill: string;
  audioUrl?: string;
  selectedQuestions: QuestionOption[];
}

export default function ExamCreateForm() {
  const router = useRouter();

  // Wizard Step: 1 = Basic Info, 2 = Sections, 3 = Question Assignment
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Basic Info
  const [title, setTitle] = useState<string>("");
  const [hskLevel, setHskLevel] = useState<number>(3);
  const [description, setDescription] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(90);

  // Step 2: Sections Configuration
  const [sections, setSections] = useState<ExamSectionDraft[]>([
    {
      tempId: "sec-1",
      title: "Phần 1: Nghe hiểu (Listening)",
      order: 1,
      skill: "LISTENING",
      selectedQuestions: [],
    },
    {
      tempId: "sec-2",
      title: "Phần 2: Đọc hiểu (Reading)",
      order: 2,
      skill: "READING",
      selectedQuestions: [],
    },
    {
      tempId: "sec-3",
      title: "Phần 3: Viết (Writing)",
      order: 3,
      skill: "WRITING",
      selectedQuestions: [],
    },
  ]);

  // Step 3: Question Picker Modal State
  const [activeSectionId, setActiveSectionId] = useState<string>("sec-1");
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<QuestionOption[]>([]);
  const [isLoadingBank, setIsLoadingBank] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSkillFilter, setPickerSkillFilter] = useState("ALL");
  const [tempCheckedQuestionIds, setTempCheckedQuestionIds] = useState<number[]>([]);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // When HSK level changes in Step 1, adapt sections preset if HSK 1-2 (usually only Listening + Reading)
  const handleHskLevelChange = (newLevel: number) => {
    setHskLevel(newLevel);
    if (newLevel <= 2 && sections.length > 2) {
      setSections([
        {
          tempId: "sec-1",
          title: "Phần 1: Nghe hiểu (Listening)",
          order: 1,
          skill: "LISTENING",
          selectedQuestions: [],
        },
        {
          tempId: "sec-2",
          title: "Phần 2: Đọc hiểu (Reading)",
          order: 2,
          skill: "READING",
          selectedQuestions: [],
        },
      ]);
    } else if (newLevel >= 3 && sections.length < 3) {
      setSections([
        {
          tempId: "sec-1",
          title: "Phần 1: Nghe hiểu (Listening)",
          order: 1,
          skill: "LISTENING",
          selectedQuestions: [],
        },
        {
          tempId: "sec-2",
          title: "Phần 2: Đọc hiểu (Reading)",
          order: 2,
          skill: "READING",
          selectedQuestions: [],
        },
        {
          tempId: "sec-3",
          title: "Phần 3: Viết (Writing)",
          order: 3,
          skill: "WRITING",
          selectedQuestions: [],
        },
      ]);
    }
  };

  // Section actions
  const addSection = () => {
    const nextOrder = sections.length + 1;
    setSections([
      ...sections,
      {
        tempId: `sec-${Date.now()}`,
        title: `Phần ${nextOrder}: Tự luận / Chuyên sâu`,
        order: nextOrder,
        skill: "ALL",
        selectedQuestions: [],
      },
    ]);
  };

  const removeSection = (tempId: string) => {
    if (sections.length <= 1) return;
    const filtered = sections.filter((s) => s.tempId !== tempId);
    const reordered = filtered.map((s, idx) => ({
      ...s,
      order: idx + 1,
    }));
    setSections(reordered);
    if (activeSectionId === tempId && reordered[0]) {
      setActiveSectionId(reordered[0].tempId);
    }
  };

  const [uploadingSectionId, setUploadingSectionId] = useState<string | null>(null);

  const updateSectionTitle = (tempId: string, newTitle: string) => {
    setSections(
      sections.map((s) => (s.tempId === tempId ? { ...s, title: newTitle } : s))
    );
  };

  const updateSectionAudio = (tempId: string, audioUrl: string) => {
    setSections(
      sections.map((s) => (s.tempId === tempId ? { ...s, audioUrl } : s))
    );
  };

  const handleSectionAudioUpload = async (tempId: string, file: File) => {
    if (!file) return;
    setUploadingSectionId(tempId);
    setErrorMsg(null);
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
        const fullUrl = path.startsWith("http") || path.startsWith("/") ? path : `/api/v1/files/${path}`;
        updateSectionAudio(tempId, fullUrl);
      }
    } catch (err: any) {
      setErrorMsg(`Lỗi tải tệp âm thanh phần thi: ${err.message}`);
    } finally {
      setUploadingSectionId(null);
    }
  };

  // Fetch Questions for Question Picker
  const fetchBankQuestions = useCallback(async () => {
    setIsLoadingBank(true);
    try {
      let url = `questions?limit=100&hskLevel=${hskLevel}`;
      if (pickerSkillFilter !== "ALL") {
        url += `&skill=${pickerSkillFilter}`;
      }
      if (pickerSearch.trim()) {
        url += `&search=${encodeURIComponent(pickerSearch.trim())}`;
      }
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        setBankQuestions(data.data || []);
      }
    } catch {
      setBankQuestions([]);
    } finally {
      setIsLoadingBank(false);
    }
  }, [hskLevel, pickerSkillFilter, pickerSearch]);

  const openQuestionPicker = (sectionId: string, sectionSkill: string) => {
    setActiveSectionId(sectionId);
    setPickerSkillFilter(sectionSkill !== "ALL" ? sectionSkill : "ALL");
    setPickerSearch("");
    const currentSection = sections.find((s) => s.tempId === sectionId);
    const initialIds = currentSection?.selectedQuestions.map((q) => q.id) || [];
    setTempCheckedQuestionIds(initialIds);
    setIsQuestionPickerOpen(true);
  };

  useEffect(() => {
    if (isQuestionPickerOpen) {
      fetchBankQuestions();
    }
  }, [isQuestionPickerOpen, pickerSkillFilter, fetchBankQuestions]);

  const toggleCheckQuestion = (qId: number) => {
    if (tempCheckedQuestionIds.includes(qId)) {
      setTempCheckedQuestionIds(tempCheckedQuestionIds.filter((id) => id !== qId));
    } else {
      setTempCheckedQuestionIds([...tempCheckedQuestionIds, qId]);
    }
  };

  const handleApplyQuestions = () => {
    const chosenQuestions = bankQuestions.filter((q) =>
      tempCheckedQuestionIds.includes(q.id)
    );

    setSections(
      sections.map((s) => {
        if (s.tempId === activeSectionId) {
          return {
            ...s,
            selectedQuestions: chosenQuestions,
          };
        }
        return s;
      })
    );
    setIsQuestionPickerOpen(false);
  };

  const removeQuestionFromSection = (sectionId: string, questionId: number) => {
    setSections(
      sections.map((s) => {
        if (s.tempId === sectionId) {
          return {
            ...s,
            selectedQuestions: s.selectedQuestions.filter((q) => q.id !== questionId),
          };
        }
        return s;
      })
    );
  };

  // Submit whole exam creation
  const handlePublishExam = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg("Vui lòng nhập tên đề thi.");
      setCurrentStep(1);
      return;
    }

    const totalSelected = sections.reduce(
      (sum, s) => sum + s.selectedQuestions.length,
      0
    );
    if (totalSelected === 0) {
      setErrorMsg("Đề thi chưa có câu hỏi nào. Vui lòng thêm câu hỏi vào các phần thi ở Bước 3.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Exam
      const examRes = await apiFetch("exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          hskLevel: Number(hskLevel),
        }),
      });

      if (!examRes.ok) {
        throw new Error(await readApiError(examRes));
      }

      const createdExam = await examRes.json();
      const examId = createdExam.id;

      // 2. Create Sections & Add Questions sequentially
      for (const section of sections) {
        const sectionRes = await apiFetch(`exams/${examId}/sections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: section.title,
            order: section.order,
            audioUrl: section.audioUrl || undefined,
          }),
        });

        if (sectionRes.ok) {
          const createdSection = await sectionRes.json();
          const sectionId = createdSection.id;

          if (section.selectedQuestions.length > 0) {
            const questionsPayload = section.selectedQuestions.map((q, idx) => ({
              questionId: q.id,
              order: idx + 1,
            }));

            await apiFetch(`exams/sections/${sectionId}/questions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                questions: questionsPayload,
              }),
            });
          }
        }
      }

      setSuccessMsg("Xuất bản đề thi thành công! Đang chuyển hướng...");
      setTimeout(() => {
        router.push("/exams");
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể xuất bản đề thi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQuestionsAllSections = sections.reduce(
    (sum, s) => sum + s.selectedQuestions.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/exams"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-500 dark:text-gray-400"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Danh sách đề thi
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Biên soạn đề thi chuẩn HSK (Cấp 1 - 9)
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quy trình 3 bước thiết lập cấu trúc đề, phân chia phần thi và chọn lọc câu hỏi từ ngân hàng
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl dark:bg-rose-500/10 dark:border-rose-900/40 dark:text-rose-400">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-900/40 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />
          {successMsg}
        </div>
      )}

      {/* 3-Step Wizard Navigation Stepper */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2 bg-gray-100 rounded-2xl dark:bg-gray-800/60">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`flex items-center gap-3 p-3 rounded-xl transition text-left ${
            currentStep === 1
              ? "bg-white text-brand-600 shadow-theme-xs font-bold dark:bg-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600 font-bold text-xs dark:bg-brand-500/20 dark:text-brand-300">
            1
          </span>
          <div>
            <div className="text-sm font-semibold">Bước 1: Thông tin đề thi</div>
            <div className="text-xs text-gray-400">Tên đề, cấp độ, thời gian</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`flex items-center gap-3 p-3 rounded-xl transition text-left ${
            currentStep === 2
              ? "bg-white text-brand-600 shadow-theme-xs font-bold dark:bg-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600 font-bold text-xs dark:bg-brand-500/20 dark:text-brand-300">
            2
          </span>
          <div>
            <div className="text-sm font-semibold">Bước 2: Cấu trúc phần thi</div>
            <div className="text-xs text-gray-400">{sections.length} phần thi (Nghe, Đọc, Viết)</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`flex items-center gap-3 p-3 rounded-xl transition text-left ${
            currentStep === 3
              ? "bg-white text-brand-600 shadow-theme-xs font-bold dark:bg-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-50 text-brand-600 font-bold text-xs dark:bg-brand-500/20 dark:text-brand-300">
            3
          </span>
          <div>
            <div className="text-sm font-semibold">Bước 3: Chọn câu hỏi</div>
            <div className="text-xs text-gray-400">Đã chọn {totalQuestionsAllSections} câu hỏi</div>
          </div>
        </button>
      </div>

      {/* Step 1: Basic Info Form */}
      {currentStep === 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs p-6 dark:bg-gray-900 dark:border-gray-800 space-y-6">
          <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Thông tin tổng thể đề thi HSK
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nhập tiêu đề, cấp độ mục tiêu và hướng dẫn làm bài cho thí sinh
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Tên đề thi / Bộ đề luyện tập <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Đề thi thử HSK 3 - Bộ đề tiêu chuẩn số 01"
                className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Cấp độ mục tiêu HSK <span className="text-rose-500">*</span>
                </label>
                <select
                  value={hskLevel}
                  onChange={(e) => handleHskLevelChange(Number(e.target.value))}
                  className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  {HSK_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      HSK {lvl} {lvl <= 2 ? "(Sơ cấp)" : lvl <= 4 ? "(Trung cấp)" : lvl <= 6 ? "(Cao cấp)" : "(Nâng cao 7-9)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Thời lượng làm bài dự kiến (Phút)
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  min={10}
                  max={240}
                  className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Mô tả đề thi & Hướng dẫn làm bài
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Hướng dẫn thí sinh: Đề gồm 3 phần thi Nghe, Đọc, Viết. Điểm đạt là 180/300 điểm..."
                className="w-full p-3.5 text-sm text-gray-800 border border-gray-300 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              onClick={() => {
                if (!title.trim()) {
                  setErrorMsg("Vui lòng nhập tên đề thi.");
                  return;
                }
                setErrorMsg(null);
                setCurrentStep(2);
              }}
            >
              Tiếp tục sang Bước 2: Cấu trúc phần thi →
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Sections Configuration */}
      {currentStep === 2 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs p-6 dark:bg-gray-900 dark:border-gray-800 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Cấu trúc các phần thi (Exam Sections)
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tổ chức các phần thi theo chuẩn HSK (Nghe, Đọc, Viết) hoặc thêm phần bổ trợ
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSection}
              startIcon={<PlusIcon className="w-4 h-4" />}
            >
              Thêm phần thi mới
            </Button>
          </div>

          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div
                key={section.tempId}
                className="p-4 bg-gray-50 border border-gray-200 rounded-xl dark:bg-gray-800/40 dark:border-gray-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 text-brand-600 font-bold text-sm dark:bg-brand-500/20 dark:text-brand-300">
                      #{section.order}
                    </span>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(section.tempId, e.target.value)}
                      className="flex-1 h-10 px-3 text-sm font-semibold text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Đã chọn: <strong>{section.selectedQuestions.length} câu</strong>
                    </span>
                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(section.tempId)}
                        className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                        title="Xóa phần thi"
                      >
                        <TrashBinIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio attachment for listening section */}
                <div className="pt-2 border-t border-gray-200/70 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="p-1 rounded-md bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                      <AudioIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Audio đề thi:
                    </span>
                    <input
                      type="text"
                      value={section.audioUrl || ""}
                      onChange={(e) => updateSectionAudio(section.tempId, e.target.value)}
                      placeholder="Dán URL file MP3 hoặc bấm Tải tệp..."
                      className="flex-1 h-8 px-2.5 text-xs text-gray-800 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-1 text-xs font-medium rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center gap-1 transition">
                      <span>{uploadingSectionId === section.tempId ? "Đang tải..." : "Tải MP3/M4A"}</span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                        disabled={uploadingSectionId === section.tempId}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSectionAudioUpload(section.tempId, file);
                        }}
                        className="hidden"
                      />
                    </label>
                    {section.audioUrl && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        ✓ Đã có audio
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(1)}
            >
              ← Quay lại Bước 1
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (sections.some((s) => !s.title.trim())) {
                  setErrorMsg("Vui lòng nhập tên cho tất cả các phần thi.");
                  return;
                }
                setErrorMsg(null);
                setCurrentStep(3);
              }}
            >
              Tiếp tục sang Bước 3: Chọn câu hỏi →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Question Assignment to Sections */}
      {currentStep === 3 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-theme-xs p-6 dark:bg-gray-900 dark:border-gray-800 space-y-6">
          <div className="border-b border-gray-100 pb-4 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Chọn câu hỏi từ Ngân hàng đề vào từng phần thi
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                HSK {hskLevel} • Tổng số câu hỏi hiện tại: <strong>{totalQuestionsAllSections} câu</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(2)}
              >
                ← Quay lại Bước 2
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handlePublishExam}
                disabled={isSubmitting || totalQuestionsAllSections === 0}
                startIcon={<CheckCircleIcon className="w-4 h-4" />}
              >
                {isSubmitting ? "Đang xuất bản đề thi..." : "Hoàn tất & Xuất bản đề thi"}
              </Button>
            </div>
          </div>

          {/* Section Selector Tabs */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-1">
              {sections.map((section) => (
                <button
                  key={section.tempId}
                  onClick={() => setActiveSectionId(section.tempId)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                    activeSectionId === section.tempId
                      ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-500/10"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {section.title} ({section.selectedQuestions.length} câu)
                </button>
              ))}
            </div>

            {/* Questions in Active Section */}
            {sections
              .filter((s) => s.tempId === activeSectionId)
              .map((curSec) => (
                <div key={curSec.tempId} className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 dark:bg-gray-800/40 dark:border-gray-800">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Danh sách câu hỏi của: <strong>{curSec.title}</strong>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openQuestionPicker(curSec.tempId, curSec.skill)}
                      startIcon={<PlusIcon className="w-4 h-4" />}
                    >
                      Chọn câu hỏi từ Ngân hàng đề
                    </Button>
                  </div>

                  {curSec.selectedQuestions.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-2xl dark:border-gray-800">
                      <DocsIcon className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
                      <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                        Chưa có câu hỏi nào được gán vào phần thi này
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => openQuestionPicker(curSec.tempId, curSec.skill)}
                      >
                        Mở thư viện chọn câu hỏi ngay
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {curSec.selectedQuestions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-theme-xs dark:bg-gray-900 dark:border-gray-800"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-700 font-bold text-xs dark:bg-gray-800 dark:text-gray-300 shrink-0">
                              {idx + 1}
                            </span>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="light" color="info" size="sm">
                                  {q.skill}
                                </Badge>
                                <span className="text-xs font-mono text-gray-400">
                                  #{q.id}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {q.payload?.text}
                              </p>
                              {q.correctAnswer?.answer && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Đáp án: {q.correctAnswer.answer}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeQuestionFromSection(curSec.tempId, q.id)}
                            className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                            title="Xóa câu hỏi khỏi phần thi"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal Question Picker from Question Bank */}
      <Modal
        isOpen={isQuestionPickerOpen}
        onClose={() => setIsQuestionPickerOpen(false)}
        className="max-w-4xl p-6 sm:p-8"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Chọn câu hỏi từ Ngân hàng đề thi
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lọc theo HSK {hskLevel} • Đã chọn {tempCheckedQuestionIds.length} câu hỏi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsQuestionPickerOpen(false)}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleApplyQuestions}
              >
                Áp dụng ({tempCheckedQuestionIds.length}) câu
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Tìm theo chữ Hán, pinyin..."
              className="h-10 px-3.5 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
            <select
              value={pickerSkillFilter}
              onChange={(e) => setPickerSkillFilter(e.target.value)}
              className="h-10 px-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            >
              <option value="ALL">Tất cả kỹ năng</option>
              <option value="LISTENING">Nghe hiểu (Listening)</option>
              <option value="READING">Đọc hiểu (Reading)</option>
              <option value="WRITING">Viết (Writing)</option>
              <option value="SPEAKING">Nói (Speaking)</option>
            </select>
          </div>

          {/* Question Items Selection List */}
          <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-100 rounded-xl p-2 dark:border-gray-800">
            {isLoadingBank ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Đang tải danh sách câu hỏi ngân hàng...
              </div>
            ) : bankQuestions.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Không tìm thấy câu hỏi HSK {hskLevel} nào phù hợp.
              </div>
            ) : (
              bankQuestions.map((q) => {
                const isChecked = tempCheckedQuestionIds.includes(q.id);
                return (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition cursor-pointer ${
                      isChecked
                        ? "bg-brand-50/60 border-brand-300 dark:bg-brand-500/10 dark:border-brand-700"
                        : "bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheckQuestion(q.id)}
                      className="mt-1 w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">
                          #{q.id}
                        </span>
                        <Badge variant="light" color="info" size="sm">
                          {q.skill}
                        </Badge>
                        <span className="text-xs text-amber-500">
                          {"★".repeat(q.difficulty)}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {q.payload?.text}
                      </p>
                      {q.correctAnswer?.answer && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Đáp án đúng: {q.correctAnswer.answer}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
