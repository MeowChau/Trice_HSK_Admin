"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/button/Button";

type FileUploadProps = {
  label: string;
  accept: string;
  kind: "image" | "audio";
  disabled?: boolean;
  onFileSelect: (file: File) => void | Promise<void>;
};

export default function FileUpload({
  label,
  accept,
  kind,
  disabled = false,
  onFileSelect,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const noun = kind === "image" ? "ảnh" : "âm thanh";

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (!disabled && file) void onFileSelect(file);
      }}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition sm:flex-row sm:text-left ${dragging ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"} ${disabled ? "opacity-60" : ""}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15"
      >
        <svg
          className="block size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Kéo thả {noun} vào đây
        </p>
        <p className="break-words text-xs text-gray-500 dark:text-gray-400">
          {accept.replaceAll(".", "").toUpperCase().split(",").join(", ")} · Tối
          đa 90 MB
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {disabled ? "Đang tải…" : `Tải ${noun} lên`}
      </Button>
      <input
        ref={inputRef}
        type="file"
        aria-label={`Tải ${label.toLowerCase()}`}
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFileSelect(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
