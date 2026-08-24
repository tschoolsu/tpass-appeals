// 申訴送出後貼到 Discord 論壇頻道（一筆申訴 = 一個 thread）。純通知用途，
// 失敗只 log 不外拋——DB 才是唯一真相來源，Discord 掛掉不該讓學生看到送出失敗。
// 逾時保護比照 tmsg 的 src/lib/chat.ts（AbortSignal.timeout）。
//
// 圖片附件走 multipart（payload_json + files[n]）把位元組直接送進 Discord。
// 不能改用「embed 放圖片 URL」——/api/files 是 admin cookie 保護的，Discord CDN
// 抓不到，只會得到一個破圖。
import "server-only";
import type { QuestionView } from "@/lib/questions";
import { answerToText } from "@/lib/answer-format";
import { gradeLabel } from "@/lib/grade";
import { getObject } from "@/lib/storage";
import { sniffImageMime } from "@/lib/image";

const TIMEOUT_MS = 20_000; // 帶附件後比純文字慢，比原本的 10 秒放寬
const MAX_FILES = 10; // Discord 單則訊息附件數上限
// Discord 免費 guild 的單則總大小上限。官方已從 8 調高，但這裡保守——
// 超過會讓整則 webhook 失敗（雖然不影響申訴本身，但通知就沒了）。
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

interface Respondent {
  name: string;
  email: string;
  grade?: number | null; // 推不出來（老師／已畢業）就是 null，不顯示
}

export interface AppealAttachment {
  storageKey: string;
  filename: string;
}

// 讀出真的是圖片、且塞得進預算的附件。位元組要重新嗅探——DB 裡的 mime 是
// 上傳者給的 file.type，不可信。
async function collectImageAttachments(
  candidates: AppealAttachment[],
): Promise<{ files: Array<{ filename: string; bytes: Uint8Array<ArrayBuffer> }>; skipped: number }> {
  const files: Array<{ filename: string; bytes: Uint8Array<ArrayBuffer> }> = [];
  let used = 0;
  let skipped = 0;

  for (const c of candidates) {
    if (files.length >= MAX_FILES) {
      skipped++;
      continue;
    }
    let buf: Buffer | null = null;
    try {
      buf = await getObject(c.storageKey);
    } catch (err) {
      console.error("[discord] 讀取附件失敗", c.storageKey, err);
    }
    if (!buf) {
      skipped++;
      continue;
    }
    // 明確配置一塊 ArrayBuffer 再複製——Buffer 背後可能是 SharedArrayBuffer，
    // 型別上不能直接當 BlobPart 用。
    const bytes = new Uint8Array(new ArrayBuffer(buf.byteLength));
    bytes.set(buf);
    if (!sniffImageMime(bytes)) continue; // 非圖片：不附加，也不算「被略過的圖」
    if (used + bytes.byteLength > MAX_ATTACHMENT_BYTES) {
      skipped++;
      continue;
    }
    used += bytes.byteLength;
    files.push({ filename: c.filename, bytes });
  }

  return { files, skipped };
}

export async function postAppealToDiscord(
  webhookUrl: string | null,
  questions: QuestionView[],
  answers: Record<string, unknown>,
  respondent: Respondent,
  attachments: AppealAttachment[] = [],
): Promise<void> {
  if (!webhookUrl) return;

  const { files, skipped } = await collectImageAttachments(attachments);

  let body = questions
    .map((q) => `**${q.title}**\n${answerToText(q, answers[q.id]) || "（未作答）"}`)
    .join("\n\n")
    .slice(0, 3900); // embed description 上限 4096，留緩衝給下面那行註記
  if (skipped > 0) {
    body += `\n\n_另有 ${skipped} 個附件過大或無法讀取，請至後台查看。_`;
  }

  const threadName = `${respondent.name} - ${new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  })}`.slice(0, 100);

  // 申訴人也寫進 embed 本體：只放 thread 標題的話，轉發、通知、搜尋結果裡就看不出是誰。
  const label = gradeLabel(respondent.grade ?? null);
  const author = label ? `${respondent.name} · ${label}` : respondent.name;

  const payload = {
    thread_name: threadName,
    embeds: [
      {
        title: "新申訴",
        author: { name: author.slice(0, 256) }, // Discord author.name 上限
        description: body,
        footer: { text: respondent.email },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    // 有附件就走 multipart（不要自己設 Content-Type，讓 fetch 帶 boundary）。
    let requestBody: BodyInit;
    let headers: HeadersInit | undefined;
    if (files.length > 0) {
      const fd = new FormData();
      fd.set("payload_json", JSON.stringify(payload));
      files.forEach((f, i) => {
        fd.set(`files[${i}]`, new Blob([f.bytes]), f.filename);
      });
      requestBody = fd;
    } else {
      requestBody = JSON.stringify(payload);
      headers = { "Content-Type": "application/json" };
    }

    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: "POST",
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[discord] 貼文失敗：HTTP ${res.status}`);
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError" ? `逾時（${TIMEOUT_MS / 1000} 秒）` : err;
    console.error("[discord] 貼文失敗", message);
  }
}
