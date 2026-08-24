// 答案驗證（isomorphic：填寫器 client 即時驗 + submit server 端再驗一次，同一份邏輯）。
// 沒有分段/跳轉，直接驗全部題目即可，比 tpass-form 的 walkVisitedQuestions 簡單很多。
import type { QuestionView } from "@/lib/questions";

export type AnswerMap = Record<string, unknown>;

function isBlank(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function validateValue(q: QuestionView, value: unknown): string | null {
  const blank = isBlank(value);
  if (blank) return q.required ? "此題必填" : null;

  switch (q.type) {
    case "short_text":
    case "paragraph":
      return typeof value === "string" ? null : "格式錯誤";
    case "single_choice": {
      if (typeof value !== "string") return "格式錯誤";
      return q.options?.some((o) => o.id === value) ? null : "選項不存在";
    }
    case "multi_choice": {
      if (!Array.isArray(value)) return "格式錯誤";
      const ids = new Set(q.options?.map((o) => o.id));
      return value.every((v) => typeof v === "string" && ids.has(v))
        ? null
        : "選項不存在";
    }
    case "file_upload":
      return Array.isArray(value) ? null : "格式錯誤";
    default:
      return null;
  }
}

export function validateAnswers(
  questions: QuestionView[],
  answers: AnswerMap,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const err = validateValue(q, answers[q.id]);
    if (err) errors[q.id] = err;
  }
  return errors;
}

// 從答案裡把 file_upload 引用到的 upload id 全撈出來。
// 用在：後台顯示附件（查 mime 決定要不要縮圖）、送出時驗證引用是否屬於本人。
export function collectUploadIds(answers: AnswerMap): string[] {
  const ids: string[] = [];
  for (const value of Object.values(answers)) {
    if (!Array.isArray(value)) continue;
    for (const f of value) {
      if (f && typeof f === "object" && typeof (f as { id?: unknown }).id === "string") {
        ids.push((f as { id: string }).id);
      }
    }
  }
  return ids;
}
