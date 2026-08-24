"use client";

// 單一題答案的呈現（後台明細頁）。檔案題不能走 answerToText——那個函式只回檔名，
// 會把 upload id 丟掉，附件就再也連不回 /api/files/<id>（這正是「圖片不見了」的成因）。
// 圖片給縮圖預覽，其餘給下載連結。
import * as React from "react";
import type { QuestionView } from "@/lib/questions";
import type { UploadedFile } from "@/components/QuestionRenderer";
import { answerToText } from "@/lib/answer-format";
import { looksLikeImage } from "@/lib/image";

const CHIP =
  "inline-block rounded-md border-2 border-foreground bg-card px-2 py-0.5 font-mono text-xs font-bold text-accent hover:underline";

function FileChip({ file }: { file: UploadedFile }) {
  return (
    <a href={`/api/files/${file.id}`} className={CHIP}>
      {file.name}
    </a>
  );
}

// 縮圖載入失敗（檔案已被清掉、或嗅探判定不可 inline 回了 415）就退回下載連結，
// 不要留一個破圖 icon 在後台。
function ImageThumb({ file }: { file: UploadedFile }) {
  const [broken, setBroken] = React.useState(false);
  if (broken) return <FileChip file={file} />;
  return (
    <a
      href={`/api/files/${file.id}?inline=1`}
      target="_blank"
      rel="noreferrer"
      title={file.name}
      className="inline-block rounded-md border-2 border-foreground bg-card shadow-[2px_2px_0_0_var(--color-foreground)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_var(--color-foreground)] transition-transform"
    >
      {/* 不用 next/image：這是授權後的端點，不該進 image optimizer 快取。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/${file.id}?inline=1`}
        alt={file.name}
        className="h-24 w-24 rounded-[4px] object-cover"
        onError={() => setBroken(true)}
      />
    </a>
  );
}

export function FileAnswer({
  files,
  mimeById,
}: {
  files: UploadedFile[];
  mimeById: Record<string, string>;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {files.map((f) =>
        looksLikeImage(mimeById[f.id] ?? "") ? (
          <ImageThumb key={f.id} file={f} />
        ) : (
          <FileChip key={f.id} file={f} />
        ),
      )}
    </span>
  );
}

export function AnswerView({
  q,
  value,
  mimeById,
}: {
  q: QuestionView;
  value: unknown;
  mimeById: Record<string, string>;
}) {
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return <span className="text-muted-foreground">（未作答）</span>;
  }
  if (q.type === "file_upload" && Array.isArray(value)) {
    return <FileAnswer files={value as UploadedFile[]} mimeById={mimeById} />;
  }
  const text = answerToText(q, value);
  return text ? (
    <span className="whitespace-pre-wrap">{text}</span>
  ) : (
    <span className="text-muted-foreground">（未作答）</span>
  );
}
