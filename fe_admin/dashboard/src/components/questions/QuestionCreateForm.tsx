"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, API_BASE_URL, readApiError } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
import {
  buildQuestionInput,
  draftFromQuestion,
  preparationIssues,
  QUESTION_TEMPLATES,
  templateFor,
  validateDraft,
  type QuestionDraft,
  type QuestionRecord,
} from "@/lib/question-editor";
import AudioClipPlayer from "./AudioClipPlayer";
import QuestionPreview from "./QuestionPreview";

const field =
  "w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700";
const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 space-y-4";
const SKILLS = [
  { value: "LISTENING", label: "Nghe" },
  { value: "READING", label: "Đọc" },
  { value: "WRITING", label: "Viết" },
  { value: "SPEAKING", label: "Nói / đọc thành tiếng" },
];

export function MediaField({
  label,
  kind,
  value,
  onChange,
  onBusyChange,
}: {
  label: string;
  kind: "image" | "audio";
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const accept =
    kind === "audio"
      ? ".mp3,.wav,.m4a,.ogg,.aac,.flac,.webm"
      : ".jpg,.jpeg,.png,.webp,.gif";
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 90 * 1024 * 1024) {
      setMessage(
        "File vượt quá 90 MB. Hãy nén hoặc chia audio thành đoạn nhỏ hơn.",
      );
      return;
    }
    if (
      !accept.split(",").some((ext) => file.name.toLowerCase().endsWith(ext))
    ) {
      setMessage("Định dạng file không phù hợp.");
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setMessage("Đang tải lên…");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await apiFetch("files/upload", { method: "POST", body });
      if (!response.ok) throw new Error(await readApiError(response));
      const data = (await response.json()) as { file?: { path?: string } };
      if (!data.file?.path)
        throw new Error("Máy chủ không trả về đường dẫn file.");
      const resolved = resolveFileUrl(data.file.path, API_BASE_URL);
      if (!resolved) throw new Error("Đường dẫn file không hợp lệ.");
      const url = new URL(resolved, "http://media-path.invalid");
      onChange(
        url.pathname.startsWith("/api/v1/files/")
          ? `${url.pathname}${url.search}`
          : resolved,
      );
      setMessage(`Đã tải ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tải file thất bại.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  const src = resolveFileUrl(value, API_BASE_URL);
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <input
        type="file"
        aria-label={`Tải ${label.toLowerCase()}`}
        accept={accept}
        disabled={busy}
        className="block w-full rounded-lg border border-dashed border-gray-300 p-3 text-sm dark:border-gray-700"
        onChange={(event) => {
          void upload(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {message && (
        <p role="status" className="text-xs text-gray-500">
          {message}
        </p>
      )}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">Dùng đường dẫn file có sẵn</summary>
        <input
          aria-label={`Đường dẫn ${label.toLowerCase()}`}
          className={`${field} mt-2`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            kind === "audio"
              ? "Audio đã tải lên hoặc URL audio"
              : "Ảnh đã tải lên hoặc URL ảnh"
          }
        />
      </details>
      {kind === "image" && src && (
        <Image
          src={src}
          unoptimized
          width={1000}
          height={700}
          style={{ height: "auto" }}
          alt={label}
          className="max-h-64 w-full rounded-lg border border-gray-200 object-contain"
        />
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-xs text-red-600"
        >
          Bỏ {kind === "audio" ? "audio" : "ảnh"} khỏi câu hỏi
        </button>
      )}
    </div>
  );
}

export default function QuestionCreateForm({
  initialQuestion,
}: {
  initialQuestion?: QuestionRecord;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuestionDraft>(() =>
    draftFromQuestion(initialQuestion),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const template = templateFor(draft.templateId);
  const edit = <K extends keyof QuestionDraft>(
    key: K,
    value: QuestionDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const chooseTemplate = (id: string) => {
    const next = templateFor(id);
    setDraft((current) => ({
      ...current,
      templateId: id,
      answer: "",
      choices: Array.from({ length: next.choices ?? 0 }, (_, i) => ({
        text: next.type === "TRUE_FALSE" ? (i === 0 ? "Đúng" : "Sai") : "",
        imageUrl: "",
      })),
      ...(next.skill !== "LISTENING"
        ? { audioUrl: "", start: "", end: "" }
        : {}),
    }));
  };
  const preview = (() => {
    try {
      return buildQuestionInput(draft, initialQuestion);
    } catch {
      return null;
    }
  })();
  const issues = preview ? preparationIssues(preview) : [];
  const source = initialQuestion?.payload.source as
    | { lessonTitle?: string; pdfPage?: number; item?: number | string }
    | undefined;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const validation = validateDraft(draft, duration);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    try {
      const body = buildQuestionInput(draft, initialQuestion);
      const response = await apiFetch(
        initialQuestion?.id ? `questions/${initialQuestion.id}` : "questions",
        {
          method: initialQuestion?.id ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      router.push("/questions");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Không lưu được câu hỏi.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        void save(event);
      }}
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]"
    >
      <div className="space-y-5">
        <section className={card}>
          <div>
            <h2 className="text-lg font-semibold">
              {initialQuestion ? "Sửa câu hỏi" : "Chọn khung câu hỏi"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Chọn dạng bài, thêm ảnh hoặc nội dung rồi chọn đáp án. Bài nghe có
              thể lưu nháp và tải audio sau.
            </p>
          </div>
          {source && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
              {source.lessonTitle} · Trang PDF {source.pdfPage} · Câu{" "}
              {source.item}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              Kỹ năng
              <select
                className={field}
                value={template.skill}
                onChange={(event) =>
                  chooseTemplate(
                    QUESTION_TEMPLATES.find(
                      (item) => item.skill === event.target.value,
                    )!.id,
                  )
                }
              >
                {SKILLS.map((skill) => (
                  <option key={skill.value} value={skill.value}>
                    {skill.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              Dạng bài
              <select
                className={field}
                value={draft.templateId}
                onChange={(event) => chooseTemplate(event.target.value)}
              >
                {QUESTION_TEMPLATES.filter(
                  (item) => item.skill === template.skill,
                ).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              Cấp độ HSK
              <select
                className={field}
                value={draft.hskLevel}
                onChange={(event) =>
                  edit("hskLevel", Number(event.target.value))
                }
              >
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    HSK {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              Độ khó
              <select
                className={field}
                value={draft.difficulty}
                onChange={(event) =>
                  edit("difficulty", Number(event.target.value))
                }
              >
                {[1, 2, 3, 4, 5].map((number) => (
                  <option key={number} value={number}>
                    {number} / 5
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className={card}>
          <h3 className="font-semibold">Đề bài</h3>
          <label className="block space-y-1.5 text-sm">
            Nội dung / hướng dẫn
            <textarea
              className={field}
              rows={3}
              value={draft.text}
              onChange={(event) => edit("text", event.target.value)}
              placeholder={template.instruction}
            />
          </label>
          <MediaField
            label="Ảnh đề bài"
            kind="image"
            value={draft.imageUrl}
            onChange={(value) => edit("imageUrl", value)}
          />
          {(template.type === "MATCHING" ||
            template.id === "read-word-bank" ||
            draft.contextImageUrl) && (
            <MediaField
              label="Ảnh ngân hàng hình / câu / từ"
              kind="image"
              value={draft.contextImageUrl}
              onChange={(value) => edit("contextImageUrl", value)}
            />
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500">
              Pinyin và nghĩa tiếng Việt (tùy chọn)
            </summary>
            <div className="mt-3 space-y-3">
              <input
                aria-label="Pinyin"
                className={field}
                value={draft.pinyin}
                onChange={(event) => edit("pinyin", event.target.value)}
                placeholder="Pinyin"
              />
              <textarea
                aria-label="Nghĩa tiếng Việt"
                className={field}
                value={draft.translation}
                onChange={(event) => edit("translation", event.target.value)}
                placeholder="Nghĩa tiếng Việt"
              />
            </div>
          </details>
        </section>
        {template.skill === "LISTENING" && (
          <section className={card}>
            <h3 className="font-semibold">Audio do bạn tải lên</h3>
            <p className="text-sm text-gray-500">
              Dùng một file riêng cho câu này, hoặc dùng lại file chung và chọn
              đoạn bắt đầu/kết thúc. File chung chỉ cần tải một lần rồi dùng
              đường dẫn đó cho các câu tiếp theo.
            </p>
            <MediaField
              label="Audio câu hỏi"
              kind="audio"
              value={draft.audioUrl}
              onChange={(value) => {
                setDuration(0);
                setDraft((current) => ({
                  ...current,
                  audioUrl: value,
                  ...(!value ? { start: "", end: "" } : {}),
                }));
              }}
            />
            {draft.audioUrl && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    Bắt đầu (giây)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className={field}
                      value={draft.start}
                      onChange={(event) => edit("start", event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    Kết thúc (giây)
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      className={field}
                      value={draft.end}
                      onChange={(event) => edit("end", event.target.value)}
                      placeholder="Để trống = hết file"
                    />
                  </label>
                </div>
                <AudioClipPlayer
                  url={draft.audioUrl}
                  start={Number(draft.start) || 0}
                  end={draft.end ? Number(draft.end) : undefined}
                  onDuration={setDuration}
                />
                {duration > 0 && (
                  <p className="text-xs text-gray-500">
                    Độ dài file: {duration.toFixed(1)} giây.
                  </p>
                )}
              </>
            )}
            <label className="block space-y-1.5 text-sm">
              Lời thoại dành cho người biên soạn
              <textarea
                className={field}
                rows={3}
                value={draft.transcript}
                onChange={(event) => edit("transcript", event.target.value)}
                placeholder="Có thể bổ sung lời thoại sau khi nghe file."
              />
            </label>
          </section>
        )}
        {template.choices && template.type !== "TRUE_FALSE" && (
          <section className={card}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Các phương án</h3>
              <button
                type="button"
                disabled={draft.choices.length >= 6}
                className="text-sm text-brand-600 disabled:opacity-40"
                onClick={() =>
                  edit("choices", [
                    ...draft.choices,
                    { text: "", imageUrl: "" },
                  ])
                }
              >
                + Thêm phương án
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Nếu ảnh đề đã có sẵn A/B/C…, chỉ cần giữ đúng số phương án và chọn
              đáp án bên dưới.
            </p>
            {draft.choices.map((choice, index) => (
              <div
                key={index}
                className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-brand-600">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <input
                    aria-label={`Nội dung phương án ${String.fromCharCode(65 + index)}`}
                    className={field}
                    value={choice.text}
                    placeholder="Chữ trong phương án (có thể để trống khi dùng ảnh)"
                    onChange={(event) =>
                      edit(
                        "choices",
                        draft.choices.map((item, i) =>
                          i === index
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    disabled={draft.choices.length <= 2}
                    className="text-xs text-red-600 disabled:opacity-30"
                    onClick={() => {
                      edit(
                        "choices",
                        draft.choices.filter((_, i) => i !== index),
                      );
                      edit("answer", "");
                    }}
                  >
                    Bỏ
                  </button>
                </div>
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">
                    Ảnh riêng cho phương án {String.fromCharCode(65 + index)}
                  </summary>
                  <div className="mt-3">
                    <MediaField
                      label={`Ảnh phương án ${String.fromCharCode(65 + index)}`}
                      kind="image"
                      value={choice.imageUrl}
                      onChange={(value) =>
                        edit(
                          "choices",
                          draft.choices.map((item, i) =>
                            i === index ? { ...item, imageUrl: value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                </details>
              </div>
            ))}
          </section>
        )}
        <section className={card}>
          <h3 className="font-semibold">Đáp án và đối chiếu</h3>
          {template.choices ? (
            <label className="block space-y-1.5 text-sm">
              Đáp án đúng
              <select
                className={field}
                value={draft.answer}
                onChange={(event) => edit("answer", event.target.value)}
              >
                <option value="">Chưa có đáp án xác nhận</option>
                {draft.choices.map((choice, i) => (
                  <option key={i} value={String.fromCharCode(65 + i)}>
                    {String.fromCharCode(65 + i)}
                    {template.type === "TRUE_FALSE"
                      ? ` — ${i === 0 ? "Đúng" : "Sai"}`
                      : choice.text
                        ? ` — ${choice.text}`
                        : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block space-y-1.5 text-sm">
              {template.manual
                ? "Hướng dẫn / tiêu chí để giảng viên chấm"
                : "Đáp án mẫu"}
              <textarea
                className={field}
                rows={3}
                value={draft.answer}
                onChange={(event) => edit("answer", event.target.value)}
                placeholder={
                  template.manual
                    ? "Bổ sung tiêu chí đánh giá. Câu này không tự chấm bằng một đáp án A/B/C."
                    : "Nhập đáp án đã xác nhận"
                }
              />
            </label>
          )}
          <label className="block space-y-1.5 text-sm">
            Giải thích đáp án
            <textarea
              className={field}
              rows={2}
              value={draft.explanation}
              onChange={(event) => edit("explanation", event.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.reviewConfirmed}
              onChange={(event) =>
                edit("reviewConfirmed", event.target.checked)
              }
              className="mt-1"
            />
            Tôi đã đối chiếu đề, phương án và đáp án/hướng dẫn chấm.
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isGameQuestion}
              onChange={(event) => edit("isGameQuestion", event.target.checked)}
            />
            Dùng cho trò chơi
          </label>
          {issues.length > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Sẽ lưu bản nháp: {issues.join(" · ")}. Bạn có thể bổ sung sau.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving
                ? "Đang lưu…"
                : initialQuestion
                  ? "Lưu thay đổi"
                  : "Tạo câu hỏi"}
            </button>
            <Link href="/questions" className="text-sm text-gray-500">
              Về danh sách
            </Link>
          </div>
        </section>
      </div>
      <aside className={`${card} h-fit xl:sticky xl:top-6`}>
        <h3 className="font-semibold">Xem trước câu hỏi</h3>
        {preview ? (
          <QuestionPreview question={preview} />
        ) : (
          <p className="text-sm text-gray-500">
            Thêm ảnh đề hoặc phương án để xem trước.
          </p>
        )}
      </aside>
    </form>
  );
}
