import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAppeal } from "@/lib/appeals";
import { getQuestions } from "@/lib/questions";
import { collectUploadIds } from "@/lib/answers";
import { prisma } from "@/lib/db";
import { gradeLabel } from "@/lib/grade";
import { cooldownEndsAt, isCoolingDown } from "@/lib/cooldown";
import { Badge } from "tpass-ui";
import { AnswerView } from "@/components/AnswerView";
import { CooldownPanel } from "@/components/admin/CooldownPanel";

export default async function AppealDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const appeal = await getAppeal(id);
  if (!appeal) notFound();

  const questions = await getQuestions(Object.keys(appeal.answers));
  const byId = new Map(questions.map((q) => [q.id, q]));

  // 附件的 mime 不在答案 JSON 裡（那裡只有 { id, name }），要另外查才知道該不該
  // 渲染縮圖。刻意不把 mime 寫進答案 JSON——那會讓新舊資料形狀不一致。
  const uploadIds = collectUploadIds(appeal.answers);
  const uploads = uploadIds.length
    ? await prisma.upload.findMany({
        where: { id: { in: uploadIds } },
        select: { id: true, mime: true },
      })
    : [];
  const mimeById = Object.fromEntries(uploads.map((u) => [u.id, u.mime]));

  // 冷卻只看這筆申訴本身：在視窗內且未豁免，它就是正在擋人的那筆，不必回頭找
  // 這個人的最新一筆。已解除的紀錄永久留著當稽核痕跡。
  const cooling = isCoolingDown(appeal);
  const waivedAt = appeal.cooldownWaivedAt;

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 font-bold text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 回申訴案件列表
      </Link>

      <div className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_0_var(--color-foreground)] mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-extrabold text-2xl">{appeal.respondentName}</h1>
          {appeal.respondentGrade && <Badge>{gradeLabel(appeal.respondentGrade)}</Badge>}
        </div>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {appeal.respondentEmail} ·{" "}
          {appeal.submittedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
        </p>
      </div>

      {waivedAt && (
        <div className="mb-6 rounded-2xl border-2 border-dashed border-foreground/40 bg-muted/40 p-4">
          <p className="font-bold text-sm">冷卻已解除</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {appeal.cooldownWaivedBy ?? "（未知）"} ·{" "}
            {waivedAt.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
          </p>
        </div>
      )}

      {cooling && (
        <div className="mb-6">
          <CooldownPanel
            appealId={appeal.id}
            endsAtLabel={cooldownEndsAt(appeal.submittedAt).toLocaleString("zh-TW", {
              timeZone: "Asia/Taipei",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {Object.entries(appeal.answers).map(([qid, value]) => {
          const q = byId.get(qid);
          if (!q) return null;
          return (
            <div
              key={qid}
              className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[3px_3px_0_0_var(--color-foreground)]"
            >
              <p className="font-bold">{q.title}</p>
              <div className="mt-2 font-medium">
                <AnswerView q={q} value={value} mimeById={mimeById} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
