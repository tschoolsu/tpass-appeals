import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { listAppeals } from "@/lib/appeals";
import { gradeLabel } from "@/lib/grade";
import { isCoolingDown } from "@/lib/cooldown";
import { Badge } from "tpass-ui";

export default async function AppealsPage() {
  const appeals = await listAppeals();

  return (
    <div>
      <h1 className="font-extrabold text-2xl tracking-tight mb-2">申訴案件</h1>
      <p className="font-medium text-muted-foreground mb-6">
        所有送出的申訴都會存在這裡（唯一真相來源），不受 Discord 通知成敗影響。
      </p>

      {appeals.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-foreground/40 bg-muted/40 p-5 text-center font-medium text-muted-foreground">
          目前還沒有任何申訴。
        </p>
      )}

      <div className="flex flex-col gap-3">
        {appeals.map((a) => (
          <Link
            key={a.id}
            href={`/admin/appeals/${a.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-foreground bg-card p-4 shadow-[3px_3px_0_0_var(--color-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--color-foreground)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold truncate">{a.respondentName}</span>
                {a.respondentGrade && <Badge>{gradeLabel(a.respondentGrade)}</Badge>}
                {isCoolingDown(a) && (
                  <Badge className="bg-accent text-primary-foreground">冷卻中</Badge>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground truncate">
                {a.respondentEmail} ·{" "}
                {a.submittedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
