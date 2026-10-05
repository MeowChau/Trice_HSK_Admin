"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, readApiError } from "@/lib/api";
import Button from "../ui/button/Button";
import Badge from "../ui/badge/Badge";
import Input from "../form/input/InputField";
import TextArea from "../form/input/TextArea";
import {
  AudioIcon,
  FileIcon,
  CheckCircleIcon,
  PlusIcon,
  TrashBinIcon,
  ShootingStarIcon,
  ChevronLeftIcon,
  EyeIcon,
} from "@/icons";

const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const SKILLS = [
  { value: "LISTENING", label: "🎧 Nghe hiểu (Listening)" },
  { value: "READING", label: "📖 Đọc hiểu (Reading)" },
  { value: "WRITING", label: "✍️ Viết (Writing)" },
  { value: "SPEAKING", label: "🎙️ Nói (Speaking)" },
];

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm 4 lựa chọn (A, B, C, D)" },
  { value: "TRUE_FALSE", label: "Đúng / Sai (True / False)" },
  { value: "MATCHING", label: "Nối từ / Ghép câu tương ứng" },
  { value: "FILL_IN_BLANK", label: "Điền từ vào chỗ trống" },
  { value: "SHORT_ANSWER", label: "Trả lời ngắn" },
  { value: "ESSAY", label: "Viết đoạn văn / Tự luận" },
];

export default function QuestionCreateForm() {
  const router = useRouter();

  // Form State
  const [hskLevel, setHskLevel] = useState<number>(1);
  const [skill, setSkill] = useState<string>("READING");
  const [type, setType] = useState<string>("MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = useState<number>(2);
  const [isGameQuestion, setIsGameQuestion] = useState<boolean>(false);

  const [questionText, setQuestionText] = useState<string>("");
  const [pinyin, setPinyin] = useState<string>("");
  const [translation, setTranslation] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [audioStartTime, setAudioStartTime] = useState<string>("");
  const [audioEndTime, setAudioEndTime] = useState<string>("");

  // Media upload & player states
  const [audioInputMode, setAudioInputMode] = useState<"upload" | "url">("upload");
  const [imageInputMode, setImageInputMode] = useState<"upload" | "url">("upload");
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioUploadStatus, setAudioUploadStatus] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [showTranscriptPreview, setShowTranscriptPreview] = useState(false);

  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  const [options, setOptions] = useState<string[]>([
    "苹果 (Píngguǒ)",
    "香蕉 (Xiāngjiāo)",
    "西瓜 (Xīguā)",
    "葡萄 (Pútao)",
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string>("A");
  const [explanation, setExplanation] = useState<string>("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Simulator Interactive state
  const [simulatedChoice, setSimulatedChoice] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const updated = options.filter((_, i) => i !== index);
      setOptions(updated);
      // Reset correct answer if it was deleted
      const deletedKey = String.fromCharCode(65 + index);
      if (correctAnswer === deletedKey) {
        setCorrectAnswer("A");
      }
    }
  };

  // Audio Player Engine
  const setupAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    audio.ontimeupdate = () => {
      setAudioCurrentTime(audio.currentTime);
      if (audioEndTime && Number(audioEndTime) > 0 && audio.currentTime >= Number(audioEndTime)) {
        audio.pause();
        setIsPlayingAudio(false);
      }
    };

    audio.onended = () => {
      setIsPlayingAudio(false);
      setAudioCurrentTime(0);
    };

    audio.onerror = () => {
      setIsPlayingAudio(false);
    };
  };

  const toggleAudio = () => {
    if (!audioUrl) return;

    if (!audioRef.current || audioRef.current.src !== audioUrl) {
      setupAudio(audioUrl);
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
    } else {
      if (audioStartTime && Number(audioStartTime) > 0 && (audio.currentTime < Number(audioStartTime) || (audioEndTime && audio.currentTime >= Number(audioEndTime)))) {
        audio.currentTime = Number(audioStartTime);
      }
      audio.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(() => {
        setIsPlayingAudio(false);
      });
    }
  };

  const seekAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setAudioCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Audio Upload Handler
  const handleAudioUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingAudio(true);
    setAudioUploadStatus(`Đang tải lên "${file.name}"...`);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("files/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const resData = await res.json();
      const path = resData?.file?.path;
      if (!path) throw new Error("Máy chủ không trả về đường dẫn tệp âm thanh.");

      const fullUrl = path.startsWith("http") || path.startsWith("/")
        ? path
        : `/api/v1/files/${path}`;

      setAudioUrl(fullUrl);
      setupAudio(fullUrl);
      setAudioUploadStatus(`✓ Đã tải: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err: any) {
      setAudioUploadStatus(null);
      setErrorMsg(`Lỗi tải tệp âm thanh: ${err.message}`);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);
    setImageUploadStatus(`Đang tải ảnh "${file.name}"...`);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("files/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      const resData = await res.json();
      const path = resData?.file?.path;
      if (!path) throw new Error("Máy chủ không trả về đường dẫn ảnh.");

      const fullUrl = path.startsWith("http") || path.startsWith("/")
        ? path
        : `/api/v1/files/${path}`;

      setImageUrl(fullUrl);
      setImageUploadStatus(`✓ Đã tải: ${file.name}`);
    } catch (err: any) {
      setImageUploadStatus(null);
      setErrorMsg(`Lỗi tải ảnh: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!questionText.trim()) {
      setErrorMsg("Vui lòng nhập nội dung câu hỏi tiếng Trung.");
      return;
    }

    if (type === "MULTIPLE_CHOICE" && options.some((opt) => !opt.trim())) {
      setErrorMsg("Vui lòng điền đầy đủ tất cả các phương án lựa chọn.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        text: questionText.trim(),
        pinyin: pinyin.trim() || undefined,
        translation: translation.trim() || undefined,
        audioUrl: audioUrl.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        transcript: transcript.trim() || undefined,
        audioTimestamp:
          audioStartTime.trim() || audioEndTime.trim()
            ? {
                start: audioStartTime.trim() ? Number(audioStartTime) : 0,
                end: audioEndTime.trim() ? Number(audioEndTime) : undefined,
              }
            : undefined,
      };

      if (type === "MULTIPLE_CHOICE" || type === "MATCHING") {
        payload.options = options.map((opt) => opt.trim());
      } else if (type === "TRUE_FALSE") {
        payload.options = ["Đúng (True / 对)", "Sai (False / 错)"];
      }

      const bodyData = {
        hskLevel: Number(hskLevel),
        skill,
        type,
        difficulty: Number(difficulty),
        payload,
        correctAnswer: {
          answer: correctAnswer,
          explanation: explanation.trim() || undefined,
        },
        isGameQuestion,
      };

      const res = await apiFetch("questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        throw new Error(await readApiError(res));
      }

      setSuccessMsg("Tạo câu hỏi thành công! Đang chuyển về danh sách...");
      setTimeout(() => {
        router.push("/questions");
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể tạo câu hỏi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuestionText("");
    setPinyin("");
    setTranslation("");
    setAudioUrl("");
    setImageUrl("");
    setTranscript("");
    setAudioStartTime("");
    setAudioEndTime("");
    setAudioUploadStatus(null);
    setImageUploadStatus(null);
    setExplanation("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("A");
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/questions"
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-500 dark:text-gray-400"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Ngân hàng câu hỏi
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Thêm câu hỏi mới vào ngân hàng
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Biên soạn câu hỏi chuẩn khảo thí HSK 1 - HSK 9, hỗ trợ âm thanh phát âm và xem trước học viên
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

      {/* Main 2-Column Split Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Form Configuration (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl shadow-theme-xs p-6 dark:bg-gray-900 dark:border-gray-800 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Meta Row: HSK Level, Skill, Type, Difficulty */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* HSK Level */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Cấp độ mục tiêu HSK <span className="text-rose-500">*</span>
                </label>
                <select
                  value={hskLevel}
                  onChange={(e) => setHskLevel(Number(e.target.value))}
                  className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  {HSK_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      HSK {lvl} {lvl <= 2 ? "(Sơ cấp)" : lvl <= 4 ? "(Trung cấp)" : lvl <= 6 ? "(Cao cấp)" : "(Nâng cao 7-9)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skill */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Kỹ năng bài thi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  {SKILLS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Question Type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Dạng bài kiểm tra <span className="text-rose-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setType(newType);
                    if (newType === "TRUE_FALSE") {
                      setOptions(["Đúng (True / 对)", "Sai (False / 错)"]);
                      setCorrectAnswer("A");
                    } else if (newType === "MULTIPLE_CHOICE" && options.length < 4) {
                      setOptions(["A", "B", "C", "D"]);
                    }
                  }}
                  className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Độ khó câu hỏi
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(Number(e.target.value))}
                  className="w-full h-11 px-4 text-sm text-gray-800 bg-white border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                >
                  <option value={1}>⭐ 1 sao - Nhận biết (Dễ)</option>
                  <option value={2}>⭐⭐ 2 sao - Thông hiểu</option>
                  <option value={3}>⭐⭐⭐ 3 sao - Vận dụng</option>
                  <option value={4}>⭐⭐⭐⭐ 4 sao - Vận dụng cao</option>
                  <option value={5}>⭐⭐⭐⭐⭐ 5 sao - Chuyên gia HSK</option>
                </select>
              </div>
            </div>

            {/* Checkbox Game PK */}
            <div className="flex items-center gap-3 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl dark:bg-amber-500/10 dark:border-amber-900/40">
              <input
                type="checkbox"
                id="isGamePk"
                checked={isGameQuestion}
                onChange={(e) => setIsGameQuestion(e.target.checked)}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <label htmlFor="isGamePk" className="text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer flex items-center gap-1.5">
                <ShootingStarIcon className="w-4 h-4 text-amber-500" />
                Sử dụng câu hỏi này cho chế độ Đấu trường Game PK 1v1 online
              </label>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                Nội dung câu hỏi (Chữ Hán) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
                placeholder="Nhập đề bài bằng chữ Hán, ví dụ: 他每天早上都去公园跑步。"
                className="w-full p-3.5 text-base text-gray-800 border border-gray-300 rounded-xl focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                required
              />
            </div>

            {/* Pinyin and Translation */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Phiên âm Pinyin (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={pinyin}
                  onChange={(e) => setPinyin(e.target.value)}
                  placeholder="Tā měitiān zǎoshang dōu qù gōngyuán pǎobù."
                  className="w-full h-11 px-4 text-sm font-mono text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Bản dịch nghĩa tiếng Việt
                </label>
                <input
                  type="text"
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder="Anh ấy mỗi buổi sáng đều đến công viên chạy bộ."
                  className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Listening & Media Section */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              skill === "LISTENING"
                ? "bg-sky-50/50 border-sky-200 dark:bg-sky-500/5 dark:border-sky-800"
                : "bg-gray-50/50 border-gray-200 dark:bg-gray-800/40 dark:border-gray-700"
            } space-y-4`}>
              <div className="flex items-center justify-between pb-2 border-b border-gray-200/80 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                    <AudioIcon className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                      Tệp âm thanh & Lời thoại bài nghe (Audio & Transcript)
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Hỗ trợ tải lên trực tiếp các tệp MP3, M4A, WAV (tối đa 100MB) hoặc dán liên kết URL
                    </p>
                  </div>
                </div>

                <div className="inline-flex p-0.5 rounded-lg bg-gray-200/70 dark:bg-gray-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setAudioInputMode("upload")}
                    className={`px-2.5 py-1 font-medium rounded-md transition ${
                      audioInputMode === "upload"
                        ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Tải tệp lên
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioInputMode("url")}
                    className={`px-2.5 py-1 font-medium rounded-md transition ${
                      audioInputMode === "url"
                        ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    }`}
                  >
                    Nhập URL
                  </button>
                </div>
              </div>

              {/* Audio Uploader or URL Input */}
              {audioInputMode === "upload" ? (
                <div>
                  <input
                    type="file"
                    ref={audioFileInputRef}
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioUpload(file);
                    }}
                    className="hidden"
                  />
                  <div
                    onClick={() => audioFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleAudioUpload(file);
                    }}
                    className={`p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition text-center ${
                      audioUrl
                        ? "border-sky-400 bg-sky-50/80 dark:border-sky-600 dark:bg-sky-500/10"
                        : "border-gray-300 hover:border-brand-500 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-2 dark:bg-sky-500/20 dark:text-sky-400">
                      <AudioIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {isUploadingAudio
                        ? "Đang tải tệp âm thanh lên máy chủ..."
                        : audioUrl
                        ? "Bấm để thay đổi tệp âm thanh khác"
                        : "Kéo thả tệp MP3 / WAV / M4A vào đây hoặc bấm để chọn"}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Hỗ trợ MP3, WAV, M4A, OGG, FLAC lên tới 100MB
                    </p>

                    {audioUploadStatus && (
                      <span className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {audioUploadStatus}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="url"
                    value={audioUrl}
                    onChange={(e) => {
                      setAudioUrl(e.target.value);
                      setupAudio(e.target.value);
                    }}
                    placeholder="https://example.com/audio/hsk-listening-clip.mp3 hoặc /api/v1/files/..."
                    className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
              )}

              {/* Integrated Audio Player (when audioUrl exists) */}
              {audioUrl && (
                <div className="p-3.5 bg-white border border-sky-200 rounded-xl dark:bg-gray-900 dark:border-sky-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleAudio}
                        className="w-9 h-9 rounded-full bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center shadow-sm transition"
                      >
                        {isPlayingAudio ? (
                          <span className="text-xs font-bold">❚❚</span>
                        ) : (
                          <span className="text-xs font-bold ml-0.5">▶</span>
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-800 dark:text-white">
                            Trình phát âm thanh bài nghe
                          </p>
                          {isPlayingAudio && (
                            <span className="flex items-center gap-0.5">
                              <span className="w-1 h-3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1 h-4 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
                          {audioUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-medium text-sky-600 dark:text-sky-400">
                        {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAudioUrl("");
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.src = "";
                          }
                          setIsPlayingAudio(false);
                          setAudioUploadStatus(null);
                        }}
                        className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium"
                      >
                        Xóa audio
                      </button>
                    </div>
                  </div>

                  {/* Scrub Slider */}
                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 100}
                    step={0.1}
                    value={audioCurrentTime}
                    onChange={seekAudio}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-600 dark:bg-gray-700"
                  />
                </div>
              )}

              {/* Timestamp Sprites (Optional for shared audio) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Bắt đầu phát từ giây thứ (Start Time - Tùy chọn)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={audioStartTime}
                    onChange={(e) => setAudioStartTime(e.target.value)}
                    placeholder="Ví dụ: 12.5 (giây)"
                    className="w-full h-9 px-3 text-xs text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Dừng phát ở giây thứ (End Time - Tùy chọn)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={audioEndTime}
                    onChange={(e) => setAudioEndTime(e.target.value)}
                    placeholder="Ví dụ: 25.0 (giây)"
                    className="w-full h-9 px-3 text-xs text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Transcript Textarea (录音文本) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Lời thoại bài nghe / Transcript (录音文本)</span>
                  <span className="text-[11px] font-normal text-gray-400 lowercase">
                    (hiển thị khi học sinh xem giải thích câu)
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Ví dụ: 男：请问，图书馆在哪儿？&#10;女：在教学楼后面。"
                  className="w-full p-3 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>

              {/* Image Illustration */}
              <div className="pt-3 border-t border-gray-200/80 dark:border-gray-700">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Hình ảnh minh họa câu hỏi (Tùy chọn)
                  </label>
                  <div className="inline-flex p-0.5 rounded-lg bg-gray-200/70 dark:bg-gray-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setImageInputMode("upload")}
                      className={`px-2 py-0.5 font-medium rounded-md transition ${
                        imageInputMode === "upload"
                          ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      Tải ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode("url")}
                      className={`px-2 py-0.5 font-medium rounded-md transition ${
                        imageInputMode === "url"
                          ? "bg-white text-gray-900 shadow-xs dark:bg-gray-800 dark:text-white"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      Dán URL
                    </button>
                  </div>
                </div>

                {imageInputMode === "upload" ? (
                  <div>
                    <input
                      type="file"
                      ref={imageFileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="hidden"
                    />
                    <div
                      onClick={() => imageFileInputRef.current?.click()}
                      className="p-3 border border-dashed rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {isUploadingImage
                          ? "Đang tải ảnh..."
                          : imageUrl
                          ? "Bấm để chọn ảnh khác"
                          : "Bấm để chọn ảnh từ máy tính (JPG, PNG, WebP)"}
                      </span>
                      {imageUploadStatus && (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {imageUploadStatus}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/images/question-pic.jpg"
                    className="w-full h-10 px-3 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                  />
                )}
              </div>
            </div>

            {/* Options Management (if MULTIPLE_CHOICE or MATCHING) */}
            {(type === "MULTIPLE_CHOICE" || type === "MATCHING") && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Các phương án lựa chọn <span className="text-rose-500">*</span>
                  </label>
                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Thêm phương án
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-10 font-bold text-sm bg-gray-100 text-gray-700 rounded-lg dark:bg-gray-800 dark:text-gray-300">
                          {letter}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Nội dung phương án ${letter}...`}
                          className="flex-1 h-10 px-3.5 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                          required
                        />
                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Correct Answer Selection */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Đáp án chính xác <span className="text-rose-500">*</span>
                </label>
                <select
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="w-full h-11 px-4 text-sm font-semibold text-emerald-700 bg-emerald-50/50 border border-emerald-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:bg-emerald-500/10 dark:border-emerald-800 dark:text-emerald-400"
                >
                  {type === "TRUE_FALSE" ? (
                    <>
                      <option value="A">Phương án A: Đúng (True)</option>
                      <option value="B">Phương án B: Sai (False)</option>
                    </>
                  ) : (
                    options.map((_, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return (
                        <option key={letter} value={letter}>
                          Phương án {letter}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Lời giải thích chi tiết
                </label>
                <input
                  type="text"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Giải thích ngữ pháp, từ vựng hoặc lý do chọn đáp án..."
                  className="w-full h-11 px-4 text-sm text-gray-800 border border-gray-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                Nhập lại
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                startIcon={<CheckCircleIcon className="w-5 h-5" />}
              >
                {isSubmitting ? "Đang lưu câu hỏi..." : "Lưu vào ngân hàng câu hỏi"}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Student Simulator Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl dark:bg-gray-800/40 dark:border-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                <EyeIcon className="w-4 h-4" />
                Mô phỏng học viên thi trực tiếp (Live Preview)
              </span>
              <span className="text-xs text-gray-400 font-medium">
                Thời gian thực
              </span>
            </div>

            {/* Simulator Phone/Card Screen */}
            <div className="mt-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-theme-sm dark:bg-gray-900 dark:border-gray-800 space-y-5">
              {/* Header Badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-500/10 dark:border-brand-800 dark:text-brand-400">
                    HSK {hskLevel}
                  </span>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {SKILLS.find((s) => s.value === skill)?.label.split(" ")[1]}
                  </span>
                </div>
                <div className="text-xs text-amber-500 font-medium">
                  {"★".repeat(difficulty)}
                </div>
              </div>

              {/* Audio Player in Simulator */}
              {(audioUrl || skill === "LISTENING") && (
                <div className="p-3.5 bg-gradient-to-r from-sky-50 to-blue-50/60 rounded-xl border border-sky-100 dark:from-sky-500/10 dark:to-blue-500/5 dark:border-sky-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={toggleAudio}
                        disabled={!audioUrl}
                        className={`w-9 h-9 flex items-center justify-center rounded-full text-white shadow-theme-xs transition ${
                          audioUrl
                            ? "bg-sky-500 hover:bg-sky-600 cursor-pointer"
                            : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                        }`}
                      >
                        {isPlayingAudio ? (
                          <span className="text-xs font-bold">❚❚</span>
                        ) : (
                          <span className="text-xs font-bold ml-0.5">▶</span>
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            Phần nghe khảo thí (Listening)
                          </span>
                          {isPlayingAudio && (
                            <span className="flex items-center gap-0.5">
                              <span className="w-1 h-3 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1 h-4 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1 h-2 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                          {audioUrl ? `${formatTime(audioCurrentTime)} / ${formatTime(audioDuration)}` : "Chưa có file audio"}
                        </span>
                      </div>
                    </div>
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => setShowTranscriptPreview(!showTranscriptPreview)}
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                      >
                        {showTranscriptPreview ? "Ẩn lời thoại" : "Xem lời thoại"}
                      </button>
                    )}
                  </div>

                  {/* Transcript Preview in Simulator */}
                  {showTranscriptPreview && transcript && (
                    <div className="p-2.5 bg-white/80 dark:bg-gray-900/80 rounded-lg border border-sky-200/60 dark:border-sky-800/60 text-xs text-gray-700 dark:text-gray-300 font-sans whitespace-pre-line leading-relaxed">
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 block mb-1 uppercase tracking-wider">
                        🎧 录音文本 (Transcript):
                      </span>
                      {transcript}
                    </div>
                  )}
                </div>
              )}

              {/* Image Preview in Simulator */}
              {imageUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="max-h-48 object-contain"
                    onError={(e) => {
                      (e.target as any).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Question Text */}
              <div className="space-y-1.5">
                <p className="text-lg font-bold text-gray-900 dark:text-white leading-relaxed font-sans">
                  {questionText || "Vui lòng nhập nội dung câu hỏi tiếng Trung..."}
                </p>
                {pinyin && (
                  <p className="text-xs font-mono text-brand-600 dark:text-brand-400">
                    {pinyin}
                  </p>
                )}
                {translation && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    {translation}
                  </p>
                )}
              </div>

              {/* Options Simulator */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                  Chọn phương án:
                </span>
                <div className="space-y-2">
                  {options.map((opt, idx) => {
                    const letter = String.fromCharCode(65 + idx);
                    const isSelected = simulatedChoice === letter;
                    const isTheCorrectOne = correctAnswer === letter;

                    let btnClass = "border-gray-200 bg-gray-50/50 hover:bg-gray-100/70 text-gray-800 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200";
                    if (isSelected) {
                      btnClass = isTheCorrectOne
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300";
                    }

                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSimulatedChoice(letter)}
                        className={`w-full flex items-center gap-3 p-3 text-left border rounded-xl transition text-sm ${btnClass}`}
                      >
                        <span className="flex items-center justify-center w-6 h-6 text-xs font-bold rounded-md bg-white border border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 shadow-theme-xs">
                          {letter}
                        </span>
                        <span className="font-medium flex-1">
                          {opt || `Phương án ${letter}`}
                        </span>
                        {isSelected && (
                          <span className="text-xs font-bold">
                            {isTheCorrectOne ? "✓ Đúng" : "✗ Sai"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Explanation Hint */}
              {explanation && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl dark:bg-emerald-500/10 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="font-bold">Giải thích: </span>
                  {explanation}
                </div>
              )}
            </div>

            {/* Instruction Tip */}
            <div className="mt-4 p-3.5 bg-blue-light-50 rounded-xl border border-blue-light-100 text-xs text-blue-light-700 dark:bg-blue-light-500/10 dark:border-blue-light-800/40 dark:text-blue-light-400 space-y-1">
              <p className="font-bold">💡 Gợi ý biên soạn chuẩn HSK:</p>
              <p>• HSK 1-2: Học viên mới học, nên có phiên âm Pinyin rõ ràng và bản dịch.</p>
              <p>• HSK 3-4: Bắt đầu làm quen hoàn toàn với chữ Hán, giảm dần Pinyin.</p>
              <p>• HSK 5-9: Đề thi học thuật và nâng cao, tuyệt đối không dùng Pinyin trong đề bài.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
