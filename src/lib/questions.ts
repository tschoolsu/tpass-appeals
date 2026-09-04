// 題目資料存取層。用獨立資料列 + order 欄位排序，不用大 JSON 文件——
// 每題可獨立新增/刪除/更新，天然沒有 tpass-form 那種併發覆蓋問題，不需要樂觀鎖。
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { qTypeSchema, optionsSchema, type QType, type Option } from "@/lib/question-schema";

export interface QuestionView {
  id: string;
  order: number;
  type: QType;
  title: string;
  description: string | null;
  required: boolean;
  options: Option[] | null;
}

interface QuestionRow {
  id: string;
  order: number;
  type: string;
  title: string;
  description: string | null;
  required: boolean;
  options: unknown;
}

function toView(row: QuestionRow): QuestionView {
  return {
    id: row.id,
    order: row.order,
    type: qTypeSchema.parse(row.type),
    title: row.title,
    description: row.description,
    required: row.required,
    options: row.options ? optionsSchema.parse(row.options) : null,
  };
}

export async function listQuestions(): Promise<QuestionView[]> {
  const rows = await prisma.question.findMany({ orderBy: { order: "asc" } });
  return rows.map(toView);
}

export async function getQuestions(ids: string[]): Promise<QuestionView[]> {
  const rows = await prisma.question.findMany({ where: { id: { in: ids } } });
  return rows.map(toView);
}

export interface QuestionInput {
  type: QType;
  title: string;
  description?: string | null;
  required: boolean;
  options?: Option[] | null;
}

export async function createQuestion(input: QuestionInput): Promise<void> {
  const max = await prisma.question.aggregate({ _max: { order: true } });
  await prisma.question.create({
    data: {
      order: (max._max.order ?? -1) + 1,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      required: input.required,
      options: input.options && input.options.length > 0 ? input.options : undefined,
    },
  });
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<void> {
  await prisma.question.update({
    where: { id },
    data: {
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      required: input.required,
      options:
        input.options && input.options.length > 0 ? input.options : Prisma.DbNull,
    },
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  try {
    await prisma.question.delete({ where: { id } });
  } catch (e) {
    // 只吞「本來就不存在」（重複點刪除鍵之類），其他 DB 錯誤照拋，不要靜默吃掉。
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return;
    }
    throw e;
  }
}

// 上下移動：跟相鄰題交換 order。用交易避免中途讀到不一致狀態。
export async function moveQuestion(id: string, direction: "up" | "down"): Promise<void> {
  const all = await prisma.question.findMany({
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const idx = all.findIndex((q) => q.id === id);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.$transaction([
    prisma.question.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.question.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
}
