"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, readApiError } from "@/lib/api";
import type { QuestionRecord } from "@/lib/question-editor";
import QuestionPreview from "../questions/QuestionPreview";
import AudioClipPlayer from "../questions/AudioClipPlayer";
import { MediaField } from "../questions/QuestionCreateForm";

interface Section {
  id?: number; title: string; order: number; audioUrl: string | null;
  sectionQuestions: { questionId: number; order: number; question?: QuestionRecord }[];
}
interface Exam { id: number; title: string; description: string | null; hskLevel: number; updatedAt: string; sections: Section[] }
const field = "w-full rounded-lg border border-gray-300 bg-transparent p-3 text-sm dark:border-gray-700";

export default function ExamEditor({ id }: { id: string }) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [questionId, setQuestionId] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void (async () => {
      try {
        const res = await apiFetch(`exams/${id}/editor`, { signal: abort.signal });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = await res.json() as Exam;
        if (!abort.signal.aborted) setExam(data);
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Không tải được đề."); }
    })();
    return () => abort.abort();
  }, [id]);
  const changeSection = (index: number, patch: Partial<Section>) => setExam(current => current && ({ ...current, sections: current.sections.map((section, i) => i === index ? { ...section, ...patch } : section) }));
  const addQuestion = async (index: number) => {
    if (!exam || !/^\d+$/.test(questionId) || Number(questionId) < 1) { setError("Nhập mã câu hỏi hợp lệ từ danh sách câu hỏi."); return; }
    setError(""); setAdding(index);
    try {
      const res = await apiFetch(`questions/${Number(questionId)}`);
      if (!res.ok) throw new Error(await readApiError(res));
      const question = await res.json() as QuestionRecord;
      if (question.hskLevel !== exam.hskLevel) throw new Error("Câu hỏi phải cùng cấp HSK với đề.");
      if (exam.sections.some(section => section.sectionQuestions.some(link => link.questionId === question.id))) throw new Error("Câu hỏi này đã có trong đề.");
      changeSection(index, { sectionQuestions: [...exam.sections[index].sectionQuestions, { questionId: question.id!, order: 0, question }] });
      setQuestionId("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Không thêm được câu hỏi."); }
    finally { setAdding(null); }
  };
  const save = async () => {
    if (!exam || uploading || adding !== null || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const res = await apiFetch(`exams/${id}`, { method: "PUT", body: JSON.stringify({
        title: exam.title, description: exam.description, hskLevel: Number(exam.hskLevel), updatedAt: exam.updatedAt,
        sections: exam.sections.map((section, index) => ({ id: section.id, title: section.title, order: index + 1, audioUrl: section.audioUrl || null,
          questions: section.sectionQuestions.map((link, order) => ({ questionId: link.questionId, order: order + 1 })) })),
      }) });
      if (!res.ok) throw new Error(await readApiError(res));
      setExam(await res.json() as Exam); setMessage("Đã lưu đề thi.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Lưu đề thất bại."); }
    finally { setSaving(false); }
  };
  if (!exam) return <p role={error ? "alert" : "status"}>{error || "Đang tải đề…"}</p>;
  let number = 0;
  return <div className="space-y-6 text-gray-900 dark:text-gray-100">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Sửa đề thi #{exam.id}</h1><p className="text-sm text-gray-500">{exam.sections.reduce((sum, section) => sum + section.sectionQuestions.length, 0)} câu · Thay đổi cấu trúc được lưu khi bấm Lưu đề.</p></div><Link href="/exams" className="text-sm text-brand-600">← Danh sách đề thi</Link></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-700">{message}</p>}
    <fieldset disabled={saving || uploading || adding !== null} className="space-y-6 disabled:opacity-60">
      <div className="rounded-2xl border border-gray-200 p-5 space-y-3 dark:border-gray-800">
        <label className="block">Tên đề<input className={field} value={exam.title} onChange={e => setExam({ ...exam, title: e.target.value })} maxLength={255} /></label>
        <label className="block">Mô tả<textarea className={field} value={exam.description || ""} onChange={e => setExam({ ...exam, description: e.target.value })} /></label>
        <label className="block">Cấp HSK<select className={field} value={exam.hskLevel} onChange={e => setExam({ ...exam, hskLevel: Number(e.target.value) })}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>HSK {i + 1}</option>)}</select></label>
      </div>
      {exam.sections.map((section, index) => <section key={section.id ?? `new-${index}`} className="rounded-2xl border border-gray-200 p-5 space-y-4 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-3"><h2 className="font-bold">Phần {index + 1}</h2><button type="button" className="text-sm text-red-600" onClick={() => setExam({ ...exam, sections: exam.sections.filter((_, i) => i !== index) })}>Bỏ phần thi</button>
          <button type="button" disabled={index === 0} className="text-sm text-brand-600 disabled:opacity-30" onClick={() => { const sections = [...exam.sections]; [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]]; setExam({ ...exam, sections }); }}>↑ Chuyển phần lên</button></div>
        <label className="block">Tên phần<input className={field} value={section.title} onChange={e => changeSection(index, { title: e.target.value })} /></label>
        <MediaField label="Audio chung của phần thi" kind="audio" value={section.audioUrl || ""} onChange={audioUrl => changeSection(index, { audioUrl })} onBusyChange={setUploading} />
        {section.audioUrl && <AudioClipPlayer url={section.audioUrl} />}
        <p className="text-sm text-gray-500">Có thể tải audio chung ở đây, hoặc vào Sửa câu hỏi để gắn file / đoạn nghe riêng và xác nhận đáp án. Sửa câu hỏi có hiệu lực ngay, kể cả ở bộ luyện tập khác dùng cùng câu.</p>
        {section.sectionQuestions.map((link, qi) => { const n = ++number; return <details key={link.questionId} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <summary className="cursor-pointer font-medium">Câu {n} · #{link.questionId} · {String(link.question?.payload.text ?? "Chưa tải nội dung")}</summary>
          <div className="mt-4 space-y-4"><div className="flex flex-wrap gap-4 text-sm">
            <Link href={`/questions/${link.questionId}/edit`} target="_blank" className="text-brand-600">Sửa câu hỏi / đáp án / audio ↗</Link>
            <button type="button" className="text-red-600" onClick={() => changeSection(index, { sectionQuestions: section.sectionQuestions.filter((_, i) => i !== qi) })}>Bỏ khỏi đề</button>
            <button type="button" disabled={qi === 0} className="text-brand-600 disabled:opacity-30" onClick={() => { const links = [...section.sectionQuestions]; [links[qi - 1], links[qi]] = [links[qi], links[qi - 1]]; changeSection(index, { sectionQuestions: links }); }}>↑ Chuyển câu lên</button>
          </div>{link.question && <QuestionPreview question={{ ...link.question, payload: { ...link.question.payload, audioUrl: link.question.payload.audioUrl || section.audioUrl } }} />}</div>
        </details>; })}
        <div className="flex gap-3"><input aria-label={`Mã câu hỏi thêm vào phần ${index + 1}`} className={field} placeholder="Mã câu hỏi trong danh sách câu hỏi" value={questionId} onChange={e => setQuestionId(e.target.value)} /><button type="button" onClick={() => void addQuestion(index)} className="whitespace-nowrap text-sm text-brand-600">Thêm câu</button></div>
      </section>)}
      <button type="button" className="text-brand-600" onClick={() => setExam({ ...exam, sections: [...exam.sections, { title: "Phần thi mới", order: exam.sections.length + 1, audioUrl: null, sectionQuestions: [] }] })}>+ Thêm phần thi</button>
      <div><button type="button" onClick={() => void save()} className="rounded-lg bg-brand-500 px-6 py-3 font-medium text-white">{saving ? "Đang lưu…" : "Lưu đề"}</button></div>
    </fieldset>
  </div>;
}
