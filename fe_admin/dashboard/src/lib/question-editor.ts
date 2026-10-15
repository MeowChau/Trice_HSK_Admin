export type QuestionSkill = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MATCHING" | "FILL_IN_BLANK" | "SHORT_ANSWER" | "ESSAY";
export interface QuestionTemplate {
  id: string; label: string; skill: QuestionSkill; type: QuestionType;
  instruction: string; choices?: number; manual?: boolean;
}
export const QUESTION_TEMPLATES: QuestionTemplate[] = [
  { id: "listen-image-choice", label: "Nghe và chọn hình", skill: "LISTENING", type: "MULTIPLE_CHOICE", choices: 3, instruction: "Nghe audio và chọn hình phù hợp." },
  { id: "listen-text-choice", label: "Nghe và chọn câu trả lời", skill: "LISTENING", type: "MULTIPLE_CHOICE", choices: 3, instruction: "Nghe audio và chọn câu trả lời đúng." },
  { id: "listen-image-matching", label: "Nghe và ghép hình", skill: "LISTENING", type: "MATCHING", choices: 3, instruction: "Nghe hội thoại và chọn hình phù hợp trong ngân hàng hình." },
  { id: "listen-true-false", label: "Nghe: đúng / sai", skill: "LISTENING", type: "TRUE_FALSE", choices: 2, instruction: "Nghe audio và xác định nội dung đúng hay sai." },
  { id: "listen-dictation", label: "Nghe và viết lại", skill: "LISTENING", type: "SHORT_ANSWER", manual: true, instruction: "Nghe audio và viết lại nội dung theo đề gốc." },
  { id: "listen-repeat", label: "Nghe và đọc lại", skill: "LISTENING", type: "SHORT_ANSWER", manual: true, instruction: "Nghe và đọc lại theo yêu cầu trong ảnh đề gốc." },
  { id: "read-image-matching", label: "Đọc câu và ghép hình", skill: "READING", type: "MATCHING", choices: 4, instruction: "Đọc câu trong đề gốc và chọn hình phù hợp." },
  { id: "read-sentence-matching", label: "Ghép câu hỏi / câu trả lời", skill: "READING", type: "MATCHING", choices: 4, instruction: "Ghép câu hỏi với câu trả lời phù hợp." },
  { id: "read-word-bank", label: "Chọn từ điền chỗ trống", skill: "READING", type: "FILL_IN_BLANK", choices: 3, instruction: "Chọn từ phù hợp để điền vào chỗ trống." },
  { id: "read-text-choice", label: "Đọc và chọn đáp án", skill: "READING", type: "MULTIPLE_CHOICE", choices: 3, instruction: "Đọc đoạn văn và chọn đáp án đúng." },
  { id: "read-true-false", label: "Đọc / xem hình: đúng / sai", skill: "READING", type: "TRUE_FALSE", choices: 2, instruction: "Xem hình, đọc câu và xác định nội dung đúng hay sai." },
  { id: "read-fill-blank", label: "Điền từ tự do", skill: "READING", type: "FILL_IN_BLANK", instruction: "Điền từ vào chỗ trống." },
  { id: "read-guided-practice", label: "Chọn lời thoại theo hình (bài nhóm)", skill: "READING", type: "SHORT_ANSWER", manual: true, instruction: "Đọc và chọn lời thoại phù hợp với từng hình trong đề gốc." },
  { id: "write-tracing", label: "Luyện viết chữ / nét", skill: "WRITING", type: "SHORT_ANSWER", manual: true, instruction: "Luyện viết theo mẫu trong ảnh đề gốc." },
  { id: "write-short-answer", label: "Viết câu trả lời ngắn", skill: "WRITING", type: "SHORT_ANSWER", instruction: "Viết câu trả lời theo yêu cầu." },
  { id: "write-essay", label: "Viết đoạn văn", skill: "WRITING", type: "ESSAY", manual: true, instruction: "Viết đoạn văn theo yêu cầu." },
  { id: "read-aloud", label: "Đọc thành tiếng", skill: "SPEAKING", type: "SHORT_ANSWER", manual: true, instruction: "Đọc thành tiếng theo yêu cầu trong ảnh đề gốc." },
];
export interface QuestionRecord {
  id?: number; hskLevel: number; skill: string; type: string; difficulty: number;
  isGameQuestion: boolean; payload: Record<string, unknown>;
  correctAnswer: { answer?: string; explanation?: string; rubric?: string; [key: string]: unknown } | null;
}
export interface QuestionDraft {
  templateId: string; hskLevel: number; difficulty: number; isGameQuestion: boolean;
  text: string; pinyin: string; translation: string; imageUrl: string; contextImageUrl: string;
  audioUrl: string; transcript: string; start: string; end: string;
  choices: { text: string; imageUrl: string }[];
  answer: string; explanation: string; reviewConfirmed: boolean;
}
const stringValue = (value: unknown) => typeof value === "string" ? value : "";
export function templateFor(id: string): QuestionTemplate {
  const template = QUESTION_TEMPLATES.find(item => item.id === id);
  if (!template) throw new Error("Dạng câu hỏi không hợp lệ.");
  return template;
}
export function draftFromQuestion(question?: QuestionRecord): QuestionDraft {
  const payload = question?.payload ?? {};
  const template = QUESTION_TEMPLATES.find(item => item.id === payload.templateId)
    ?? QUESTION_TEMPLATES.find(item => item.skill === question?.skill && item.type === question?.type)
    ?? templateFor("read-text-choice");
  const options = Array.isArray(payload.options) ? payload.options : [];
  const images = Array.isArray(payload.optionImages) ? payload.optionImages : [];
  const stamp = payload.audioTimestamp as { start?: number; end?: number } | undefined;
  return {
    templateId: template.id, hskLevel: question?.hskLevel ?? 1, difficulty: question?.difficulty ?? 1,
    isGameQuestion: question?.isGameQuestion ?? false, text: stringValue(payload.text),
    pinyin: stringValue(payload.pinyin), translation: stringValue(payload.translation),
    imageUrl: stringValue(payload.imageUrl), contextImageUrl: stringValue(payload.contextImageUrl),
    audioUrl: stringValue(payload.audioUrl), transcript: stringValue(payload.transcript),
    start: stamp?.start === undefined ? "" : String(stamp.start), end: stamp?.end === undefined ? "" : String(stamp.end),
    choices: Array.from({ length: options.length || template.choices || 0 }, (_, i) => ({ text: stringValue(options[i]) || (template.type === "TRUE_FALSE" ? (i === 0 ? "Đúng" : "Sai") : ""), imageUrl: stringValue(images[i]) })),
    answer: stringValue(question?.correctAnswer?.answer ?? question?.correctAnswer?.rubric),
    explanation: stringValue(question?.correctAnswer?.explanation), reviewConfirmed: payload.reviewRequired !== true,
  };
}
export function validateDraft(draft: QuestionDraft, duration?: number): string | null {
  const template = templateFor(draft.templateId);
  if (!Number.isInteger(draft.hskLevel) || draft.hskLevel < 1 || draft.hskLevel > 9) return "Cấp độ HSK phải từ 1 đến 9.";
  if (!Number.isInteger(draft.difficulty) || draft.difficulty < 1 || draft.difficulty > 5) return "Độ khó phải từ 1 đến 5.";
  if (template.choices) {
    if (draft.choices.length < 2 || draft.choices.length > 6) return "Cần từ 2 đến 6 phương án.";
    if (draft.choices.some(choice => !choice.text.trim() && !choice.imageUrl.trim()) && !draft.imageUrl.trim() && !draft.contextImageUrl.trim())
      return "Mỗi phương án cần chữ hoặc ảnh. Nếu dùng ảnh đề chứa sẵn các phương án, hãy tải ảnh đề lên.";
    if (draft.answer && !draft.choices.some((_, index) => String.fromCharCode(65+index) === draft.answer)) return "Đáp án phải thuộc danh sách phương án.";
  }
  if (draft.start || draft.end) {
    if (!draft.audioUrl.trim()) return "Hãy tải audio lên trước khi chọn đoạn nghe.";
    const start = draft.start ? Number(draft.start) : 0;
    const end = draft.end ? Number(draft.end) : undefined;
    if (!Number.isFinite(start) || start < 0 || (end !== undefined && (!Number.isFinite(end) || end <= start))) return "Thời gian kết thúc phải lớn hơn thời gian bắt đầu, và thời gian bắt đầu không được âm.";
    if (duration && (start >= duration || (end !== undefined && end > duration+0.1))) return "Đoạn nghe vượt quá độ dài audio.";
  }
  return null;
}
export function buildQuestionInput(draft: QuestionDraft, original?: QuestionRecord): QuestionRecord {
  const template = templateFor(draft.templateId);
  const error = validateDraft(draft);
  if (error) throw new Error(error);
  const choices = template.type === "TRUE_FALSE" ? [{ text: "Đúng", imageUrl: "" }, { text: "Sai", imageUrl: "" }] : draft.choices;
  const payload: Record<string, unknown> = {
    ...original?.payload, schemaVersion: 1, templateId: template.id,
    text: draft.text.trim() || template.instruction, pinyin: draft.pinyin.trim(), translation: draft.translation.trim(),
    imageUrl: draft.imageUrl.trim(), contextImageUrl: draft.contextImageUrl.trim(),
    audioUrl: draft.audioUrl.trim(), transcript: draft.transcript.trim(),
    audioTimestamp: draft.start || draft.end ? { start: draft.start ? Number(draft.start) : 0, ...(draft.end ? { end: Number(draft.end) } : {}) } : null,
    options: template.choices ? choices.map(choice => choice.text.trim()) : [],
    optionImages: template.choices ? choices.map(choice => choice.imageUrl.trim()) : [],
    manualGrading: template.manual === true, reviewRequired: !draft.reviewConfirmed,
  };
  if (template.skill === "LISTENING") payload.audioStatus = draft.audioUrl.trim() ? "uploaded" : "awaiting-upload";
  else { delete payload.audioStatus; delete payload.audioGroup; }
  return {
    hskLevel: draft.hskLevel, skill: template.skill, type: template.type, difficulty: draft.difficulty,
    isGameQuestion: draft.isGameQuestion, payload,
    correctAnswer: draft.answer.trim() ? { ...(template.manual ? { rubric: draft.answer.trim() } : { answer: draft.answer.trim() }), explanation: draft.explanation.trim() } : null,
  };
}
export function preparationIssues(question: QuestionRecord): string[] {
  const issues: string[] = [];
  if (question.skill === "LISTENING" && !question.payload.audioUrl) issues.push("Chờ audio");
  if (!question.correctAnswer?.answer && !question.correctAnswer?.rubric) issues.push(question.payload.manualGrading ? "Chờ hướng dẫn chấm" : "Chờ đáp án");
  if (question.payload.reviewRequired === true) issues.push("Chờ đối chiếu đề");
  return issues;
}
