// 申訴送出後貼到 Discord 論壇頻道（一筆申訴 = 一個 thread）。純通知用途，
// 失敗只 log 不外拋——DB 才是唯一真相來源，Discord 掛掉不該讓學生看到送出失敗。
// 逾時保護比照 tmsg 的 src/lib/chat.ts（AbortSignal.timeout）。
//
// ⚠️ 這則通知**只送辨識資訊，不送內容**（2026-08-26 加固計畫 A4）。
// 理由：Discord 頻道的成員名單不在 T-Pass 的權限模型裡——auth 的 /admin 把某人的 role
// 降回 default 只擋得住後台，擋不住頻道；卸任、畢業都不會自動收權。而且 Discord 沒有
// 稽核紀錄、沒有保留政策，附件一旦上傳就等於在 /api/files 的 admin cookie 之外多開一條
// 沒有驗證的取檔路徑。申訴內容常含糾紛細節與第三人姓名，而申訴的對象很可能就在頻道裡。
// 🚫 不要「順手」把答案、email 或附件加回來。要看內容就點連結進後台，那裡才管得住。
import "server-only";
import { gradeLabel } from "@/lib/grade";

const TIMEOUT_MS = 10_000;

interface Respondent {
  name: string;
  email: string;
  grade?: number | null; // 推不出來（老師／已畢業）就是 null，不顯示
}

// appealUrl 由呼叫端組（`${authConfig.selfUrl}/admin/appeals/<id>`）——本檔不讀 env，
// 維持純格式化，網域一律 env 驅動。
export async function postAppealToDiscord(
  webhookUrl: string | null,
  appealUrl: string,
  respondent: Respondent,
  attachmentCount = 0,
): Promise<void> {
  if (!webhookUrl) return;

  const threadName = `${respondent.name} - ${new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  })}`.slice(0, 100);

  // 申訴人也寫進 embed 本體：只放 thread 標題的話，轉發、通知、搜尋結果裡就看不出是誰。
  const label = gradeLabel(respondent.grade ?? null);
  const author = label ? `${respondent.name} · ${label}` : respondent.name;

  // 附件只報數量，不報檔名——檔名本身就可能是實名或事件描述。
  const lines = [`內容不在此顯示，請至後台查看：[開啟這筆申訴](${appealUrl})`];
  if (attachmentCount > 0) lines.push(`（含 ${attachmentCount} 個附件）`);

  const payload = {
    thread_name: threadName,
    embeds: [
      {
        title: "新申訴",
        author: { name: author.slice(0, 256) }, // Discord author.name 上限
        description: lines.join("\n"),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(`${webhookUrl}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
