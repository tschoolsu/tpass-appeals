"use client";

// 冷卻狀態區塊（申訴詳情頁）。只有「還在擋人的那筆申訴」才給解除按鈕；
// 是否顯示、顯示哪一種狀態由 server 端算好（見 lib/cooldown.ts），這裡只負責互動。
import * as React from "react";
import { useRouter } from "next/navigation";
import { TimerReset } from "lucide-react";
import { waiveCooldownAction } from "@/app/admin/appeals/actions";
import { Button } from "tpass-ui";

export function CooldownPanel({
  appealId,
  endsAtLabel,
}: {
  appealId: string;
  endsAtLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleWaive() {
    setError(null);
    startTransition(async () => {
      const res = await waiveCooldownAction(appealId);
      if (!res.ok) {
        setError(res.error ?? "解除失敗，請重試。");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border-2 border-foreground bg-muted/40 p-4 shadow-[3px_3px_0_0_var(--color-foreground)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm">冷卻中</p>
          <p className="mt-0.5 font-medium text-xs text-muted-foreground">
            這位同學要到 {endsAtLabel} 才能再送一件。解除後可立即補送（僅此一次）。
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={handleWaive} disabled={pending}>
          <TimerReset className="h-4 w-4" />
          {pending ? "解除中…" : "解除冷卻"}
        </Button>
      </div>
      {error && <p className="mt-2 font-mono text-xs font-bold text-destructive">{error}</p>}
    </div>
  );
}
