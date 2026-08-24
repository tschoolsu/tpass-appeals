"use client";

// 共用題目渲染器：填寫頁與後台題目管理的「預覽」共用同一份，所見即所得。
// 裁剪自 tpass-form 的 QuestionRenderer，只留申訴表單實際用得到的 5 種題型。
import * as React from "react";
import { Upload, X } from "lucide-react";
import type { QuestionView } from "@/lib/questions";
import { Input, Textarea, cn } from "@/components/ui/primitives";

export interface UploadedFile {
  id: string;
  name: string;
}

interface RendererProps {
  question: QuestionView;
  value: unknown;
  onChange?: (v: unknown) => void; // 省略 → 唯讀預覽
  error?: string;
}

export function QuestionRenderer({ question: q, value, onChange, error }: RendererProps) {
  const readOnly = !onChange;
  return (
    <div>
      <div className="flex items-start gap-1.5">
        <span className="font-bold text-foreground">
          {q.title || <span className="text-muted-foreground">（未命名題目）</span>}
        </span>
        {q.required && <span className="text-destructive font-bold">*</span>}
      </div>
      {q.description && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">{q.description}</p>
      )}
      <div className="mt-3">
        <Field q={q} value={value} onChange={onChange} readOnly={readOnly} />
      </div>
      {error && <p className="mt-2 font-mono text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}

function Field({
  q,
  value,
  onChange,
  readOnly,
}: {
  q: QuestionView;
  value: unknown;
  onChange?: (v: unknown) => void;
  readOnly: boolean;
}) {
  const emit = (v: unknown) => onChange?.(v);

  switch (q.type) {
    case "short_text":
      return (
        <Input
          value={(value as string) ?? ""}
          disabled={readOnly}
          placeholder="你的回答"
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "paragraph":
      return (
        <Textarea
          value={(value as string) ?? ""}
          disabled={readOnly}
          placeholder="你的回答"
          onChange={(e) => emit(e.target.value)}
        />
      );
    case "single_choice":
      return (
        <div className="flex flex-col gap-2">
          {q.options?.map((o) => (
            <label key={o.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name={q.id}
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={value === o.id}
                disabled={readOnly}
                onChange={() => emit(o.id)}
              />
              <span className="font-medium">{o.label}</span>
            </label>
          ))}
        </div>
      );
    case "multi_choice": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (id: string) =>
        emit(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
      return (
        <div className="flex flex-col gap-2">
          {q.options?.map((o) => (
            <label key={o.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={arr.includes(o.id)}
                disabled={readOnly}
                onChange={() => toggle(o.id)}
              />
              <span className="font-medium">{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case "file_upload":
      return <FileField q={q} value={value} emit={emit} readOnly={readOnly} />;
    default:
      return null;
  }
}

// 檔案挑選器的過濾（只是方便，不是把關——真正的把關在 /api/upload 嗅探位元組）。
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";

function FileField({
  q,
  value,
  emit,
  readOnly,
}: {
  q: QuestionView;
  value: unknown;
  emit: (v: unknown) => void;
  readOnly: boolean;
}) {
  const files = Array.isArray(value) ? (value as UploadedFile[]) : [];
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const maxFiles = 5;
  const maxSizeMB = 10;
  const canUpload = !readOnly;

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    setErr(null);
    const incoming = Array.from(list);
    if (files.length + incoming.length > maxFiles) {
      setErr(`最多上傳 ${maxFiles} 個檔案`);
      return;
    }
    setBusy(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of incoming) {
        if (file.size > maxSizeMB * 1024 * 1024) {
          setErr(`「${file.name}」超過 ${maxSizeMB}MB`);
          continue;
        }
        const fd = new FormData();
        fd.set("file", file);
        fd.set("questionId", q.id);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          // 伺服器端是嗅探位元組而非看副檔名，所以 415 要講清楚是格式問題，
          // 否則使用者會對著同一個檔案一直重試。
          setErr(
            res.status === 415
              ? `「${file.name}」格式不支援（只接受 PNG / JPEG / GIF / WebP / PDF）`
              : res.status === 429
                ? "今日上傳次數已達上限，請明天再試"
                : res.status === 413
                  ? `「${file.name}」超過 ${maxSizeMB}MB`
                  : "上傳失敗，請再試一次",
          );
          continue;
        }
        const data = (await res.json()) as { id: string; filename: string };
        uploaded.push({ id: data.id, name: data.filename });
      }
      if (uploaded.length) emit([...files, ...uploaded]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-2 w-fit rounded-xl border-2 border-dashed border-foreground/50 bg-muted px-4 py-3 font-bold text-sm",
          canUpload ? "cursor-pointer hover:border-foreground" : "opacity-60 cursor-not-allowed",
        )}
      >
        <Upload className="h-4 w-4" />
        {busy ? "上傳中…" : "選擇檔案"}
        <input
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          disabled={!canUpload || busy}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
        圖片或 PDF，最多 {maxFiles} 個，單檔 ≤ {maxSizeMB}MB
      </p>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-md border-2 border-foreground bg-card px-2 py-1 text-sm font-medium"
            >
              <span className="truncate">{f.name}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => emit(files.filter((x) => x.id !== f.id))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="移除"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-2 font-mono text-xs font-bold text-destructive">{err}</p>}
    </div>
  );
}
