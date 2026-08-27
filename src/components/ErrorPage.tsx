// 使用者看得到的錯誤畫面（B4）。抄自 tpass-auth/src/components/ErrorPage.tsx，
// 讓「資料庫連不上 / server action 炸掉 / 網址打錯」不再是 Next 預設的英文白畫面。
//
// 刻意沒有 "use client"：本身零互動，所以 not-found.tsx（server component）與
// error.tsx（client component）可以共用同一份；被 client 檔 import 時它就跟著變成 client。
// ⚠️ 正因為如此，這裡不能 import server-only 的 config——出口網址一律走 lib/exit-links.ts。
import { ShieldAlert } from "lucide-react";
import { FEEDBACK_URL, HOME_URL, PORTAL_URL } from "@/lib/exit-links";

const btn =
  "inline-flex items-center justify-center rounded-xl border-2 border-foreground px-4 py-2 font-bold text-foreground shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)] active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-foreground)]";

export function ErrorPage({
  code,
  title,
  message,
  hint,
  onRetry,
}: {
  code: string;
  title: string;
  message: string;
  // 給使用者看的補充線索（例如錯誤代碼）。⚠️ 絕不要把例外訊息原文倒進來——那是給 log 的。
  hint?: string;
  // 有傳才顯示「再試一次」（error.tsx 的 reset）。
  onRetry?: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_var(--color-foreground)] sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-foreground bg-tone-orange-bg text-tone-orange-text shadow-[3px_3px_0_0_var(--color-foreground)]">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <p className="mt-5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            T-PASS // {code}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-3 font-medium text-muted-foreground">{message}</p>
          {hint && (
            <p className="mt-4 rounded-md border-2 border-foreground bg-muted px-3 py-2 font-mono text-xs font-bold text-foreground">
              {hint}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {onRetry && (
              <button type="button" onClick={onRetry} className={`${btn} bg-primary text-primary-foreground`}>
                再試一次
              </button>
            )}
            <a href={HOME_URL} className={`${btn} bg-card`}>
              回本站首頁
            </a>
            {PORTAL_URL !== HOME_URL && (
              <a href={PORTAL_URL} className={`${btn} bg-card`}>
                回門戶大廳
              </a>
            )}
          </div>
          {/* 回報管道（B5）。撞到錯誤的人是最有資訊的人，這裡是唯一能把資訊送回來的路。 */}
          <p className="mt-5 text-sm font-medium text-muted-foreground">
            一直失敗？{" "}
            <a
              href={FEEDBACK_URL}
              className="font-bold text-foreground underline decoration-2 underline-offset-4 hover:text-primary"
            >
              回報給數位部
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
