"use client";
// 這個服務的錯誤邊界（B4）。Next 規定 error.tsx 必須是 client component。
// 沒有它 → 資料庫連不上或 server action 拋例外時，學生看到的是 Next 預設英文白畫面。
import { useEffect } from "react";
import { ErrorPage } from "@/components/ErrorPage";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 例外原文只進 console（＝主機上的 pm2 log），不進畫面：訊息裡可能有連線字串等內部細節。
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <ErrorPage
      code="500 ERROR"
      title="系統暫時出了點問題"
      message="這不是你的操作造成的。可以先按「再試一次」；如果一直失敗，請回報給數位部。"
      hint={error.digest ? `錯誤代碼 ${error.digest}（回報時附上這串，數位部才查得到）` : undefined}
      onRetry={reset}
    />
  );
}
