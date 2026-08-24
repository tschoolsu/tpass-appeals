"use server";

// 後台對申訴案件的操作。目前只有「解除冷卻」：讓被 30 分鐘冷卻擋住的學生能立刻補送。
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/guard";
import { waiveCooldown } from "@/lib/appeals";

export interface WaiveResult {
  ok: boolean;
  error?: string;
}

export async function waiveCooldownAction(appealId: string): Promise<WaiveResult> {
  const session = await requireAdmin("/admin");

  // 解除者一律用驗章後 session 的 email，不收 client 傳來的身分（稽核紀錄要可信）。
  const done = await waiveCooldown(appealId, session.email);
  if (!done) {
    return { ok: false, error: "這筆申訴已不在冷卻中（可能已過期或已被解除）。" };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/appeals/${appealId}`);
  return { ok: true };
}
