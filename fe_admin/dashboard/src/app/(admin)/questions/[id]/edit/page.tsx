"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, readApiError } from "@/lib/api";
import type { QuestionRecord } from "@/lib/question-editor";
import QuestionCreateForm from "@/components/questions/QuestionCreateForm";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function QuestionEditPage() {
  const { id } = useParams<{ id: string }>();
  const [question, setQuestion] = useState<QuestionRecord | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const response = await apiFetch(`questions/${id}`, { signal: abort.signal });
        if (!response.ok) throw new Error(await readApiError(response));
        if (!abort.signal.aborted) setQuestion(await response.json() as QuestionRecord);
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Không tải được câu hỏi."); }
    })();
    return () => abort.abort();
  }, [id]);
  return <div><PageBreadcrumb pageTitle="Sửa câu hỏi / gắn audio" />{error ? <p role="alert" className="text-red-600">{error}</p> : question ? <QuestionCreateForm key={question.id} initialQuestion={question} /> : <p className="text-gray-500">Đang tải câu hỏi…</p>}</div>;
}
