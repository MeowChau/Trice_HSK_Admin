"use client";
import { useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { resolveFileUrl } from "@/lib/media-url";

export default function AudioClipPlayer({ url, start = 0, end, onDuration }: {
  url: string; start?: number; end?: number; onDuration?: (seconds: number) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const src = resolveFileUrl(url, API_BASE_URL);
  if (!src) return null;
  return <div className="space-y-2">
    <audio key={src} ref={ref} src={src} controls preload="metadata" className="w-full"
      onLoadedMetadata={() => { const audio = ref.current; setFailed(false); if (audio && Number.isFinite(audio.duration)) onDuration?.(audio.duration); }}
      onPlay={() => { const audio = ref.current; if (audio && (audio.currentTime < start || (end !== undefined && audio.currentTime >= end))) audio.currentTime = start; }}
      onTimeUpdate={() => { const audio = ref.current; if (audio && end !== undefined && audio.currentTime >= end) { audio.pause(); audio.currentTime = start; } }}
      onError={() => setFailed(true)} />
    {(start > 0 || end !== undefined) && <p className="text-xs text-gray-500">Đoạn nghe: {start}s → {end === undefined ? "hết file" : `${end}s`}</p>}
    {failed && <p role="alert" className="text-sm text-red-600">Không tải được audio. Kiểm tra file hoặc đường dẫn âm thanh.</p>}
  </div>;
}
