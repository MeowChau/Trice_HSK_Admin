"use client";
import { useState } from "react";
import Image from "next/image";
import { API_BASE_URL } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";
import { preparationIssues, type QuestionRecord } from "@/lib/question-editor";
import AudioClipPlayer from "./AudioClipPlayer";

export default function QuestionPreview({
  question,
}: {
  question: QuestionRecord;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const payload = question.payload;
  const options = Array.isArray(payload.options) ? payload.options : [];
  const images = Array.isArray(payload.optionImages)
    ? payload.optionImages
    : [];
  const stamp = payload.audioTimestamp as {
    start?: number;
    end?: number;
  } | null;
  const source = payload.source as
    | {
        lessonTitle?: string;
        pdfPage?: number;
        item?: string | number;
        answerProvenance?: string;
      }
    | undefined;
  const issues = preparationIssues(question);
  const media = (value: unknown) =>
    typeof value === "string" ? resolveFileUrl(value, API_BASE_URL) : null;
  return (
    <div className="space-y-5">
      {source && (
        <p className="text-xs text-gray-500">
          {source.lessonTitle} · Trang PDF {source.pdfPage} · Câu {source.item}
        </p>
      )}
      {source?.answerProvenance === "derived-from-original-question" && (
        <p className="text-xs text-gray-500">
          Đáp án được đối chiếu từ câu gốc; sách scan không kèm đáp án.
        </p>
      )}
      {issues.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Bản nháp: {issues.join(" · ")}
        </div>
      )}
      <p className="text-lg font-medium whitespace-pre-wrap">
        {String(payload.text ?? "")}
      </p>
      {typeof payload.audioUrl === "string" && payload.audioUrl && (
        <AudioClipPlayer
          url={payload.audioUrl}
          start={stamp?.start}
          end={stamp?.end}
        />
      )}
      {question.skill === "LISTENING" && !payload.audioUrl && (
        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-900/20 dark:text-sky-200">
          Chưa có audio. Tải file trong màn hình sửa câu hỏi; có thể dùng file
          riêng hoặc chọn một đoạn trong audio chung.
        </p>
      )}
      {[
        payload.contextImageUrl,
        payload.imageUrl,
        payload.continuationImageUrl,
      ].map((value, i) =>
        media(value) ? (
          <Image
            key={i}
            src={media(value)!}
            unoptimized
            width={1400}
            height={1000}
            style={{ height: "auto" }}
            alt={
              i === 0
                ? "Ngân hàng phương án"
                : i === 1
                  ? "Đề gốc"
                  : "Phần đề tiếp sang trang sau"
            }
            className="mx-auto max-h-[700px] w-full object-contain rounded-lg border border-gray-200"
          />
        ) : null,
      )}
      {options.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, i) => {
            const key = String.fromCharCode(65 + i);
            const src = media(images[i]);
            return (
              <button
                type="button"
                key={key}
                onClick={() => setChoice(key)}
                className={`rounded-xl border p-3 text-left ${choice === key ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-gray-200 dark:border-gray-700"}`}
              >
                <span className="font-bold text-brand-600">{key}. </span>
                {String(option || `Phương án ${key}`)}
                {src && (
                  <Image
                    src={src}
                    unoptimized
                    width={600}
                    height={400}
                    style={{ height: "auto" }}
                    alt={`Phương án ${key}`}
                    className="mt-2 max-h-44 w-full object-contain"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
      {options.length === 0 && (
        <textarea
          aria-label="Câu trả lời thử"
          placeholder={
            payload.manualGrading
              ? "Câu trả lời sẽ do giảng viên đánh giá."
              : "Nhập câu trả lời thử…"
          }
          className="w-full rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-900"
        />
      )}
      <button
        type="button"
        onClick={() => setShowAnswer(!showAnswer)}
        className="text-sm font-medium text-brand-600"
      >
        {showAnswer ? "Ẩn" : "Xem"} đáp án / hướng dẫn chấm
      </button>
      {showAnswer && (
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
          {question.correctAnswer ? (
            <>
              <p className="whitespace-pre-wrap">
                {question.correctAnswer.answer ?? question.correctAnswer.rubric}
              </p>
              <p className="mt-2 text-sm text-gray-500 whitespace-pre-wrap">
                {question.correctAnswer.explanation}
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Chưa có đáp án xác nhận. Sách scan không kèm đáp án; bổ sung sau
              khi đối chiếu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
