// 申訴案件（提交紀錄）資料存取層。DB 為唯一真相來源／備份，不受 Discord 通知成敗影響。
import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { COOLDOWN_MS } from "@/lib/cooldown";

export interface AppealRow {
  id: string;
  respondentName: string;
  respondentEmail: string;
  respondentGrade: number | null;
  answers: Record<string, unknown>;
  submittedAt: Date;
  cooldownWaivedAt: Date | null;
  cooldownWaivedBy: string | null;
}

export async function listAppeals(): Promise<AppealRow[]> {
  const rows = await prisma.appeal.findMany({ orderBy: { submittedAt: "desc" } });
  return rows.map(toRow);
}

export async function getAppeal(id: string): Promise<AppealRow | null> {
  const row = await prisma.appeal.findUnique({ where: { id } });
  return row ? toRow(row) : null;
}

// 提交前的冷卻檢查：這個人有沒有還在擋人的申訴（已被管理員豁免的不算）。
// 接受 tx 是因為 actions.ts 把「查 + 建」包進同一交易並鎖 respondentSub 序列化——
// 單獨呼叫 findFirst 再各自 create 中間沒鎖，並發下能無上限繞過冷卻。
export async function findBlockingAppeal(
  respondentSub: string,
  now: Date = new Date(),
  client: Prisma.TransactionClient = prisma,
): Promise<{ id: string } | null> {
  return client.appeal.findFirst({
    where: {
      respondentSub,
      submittedAt: { gt: new Date(now.getTime() - COOLDOWN_MS) },
      cooldownWaivedAt: null,
    },
    select: { id: true },
  });
}

// 用 updateMany 一次帶條件寫入，而不是先讀再寫：兩個管理員同時按也只有一個會寫進去，
// count 就是「這次是否真的解除了」。回 false 的原因可能是不存在／已過期／已被解除，
// 三者對操作者的意義相同（現在沒有 CD 可解），所以不特別區分。
export async function waiveCooldown(
  id: string,
  byEmail: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { count } = await prisma.appeal.updateMany({
    where: {
      id,
      cooldownWaivedAt: null,
      submittedAt: { gt: new Date(now.getTime() - COOLDOWN_MS) },
    },
    data: { cooldownWaivedAt: now, cooldownWaivedBy: byEmail },
  });
  return count === 1;
}

function toRow(row: {
  id: string;
  respondentName: string;
  respondentEmail: string;
  respondentGrade: number | null;
  answers: unknown;
  submittedAt: Date;
  cooldownWaivedAt: Date | null;
  cooldownWaivedBy: string | null;
}): AppealRow {
  return {
    id: row.id,
    respondentName: row.respondentName,
    respondentEmail: row.respondentEmail,
    respondentGrade: row.respondentGrade,
    answers: row.answers as Record<string, unknown>,
    submittedAt: row.submittedAt,
    cooldownWaivedAt: row.cooldownWaivedAt,
    cooldownWaivedBy: row.cooldownWaivedBy,
  };
}
