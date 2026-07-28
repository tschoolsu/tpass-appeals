// Server 端守門小工具，供 server actions / route handlers 重用。
// 頁面/layout 的 UI 版 forbidden 由元件處理（見 components/common/Forbidden）。
import "server-only";
import { redirect } from "next/navigation";
import { getSession, permOf, type TPassClaims } from "@/lib/tpass-auth";
import { isAdmin, isSuperAdmin } from "@/config/admin";
import { loginUrlFor, deniedUrlFor } from "@/config/auth";

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export async function requireSession(returnPath = "/"): Promise<TPassClaims> {
  const session = await getSession();
  if (!session) redirect(loginUrlFor(returnPath));
  // ban（read:false）→ 導去 auth 的 /denied 看原因；reason 不經過這裡，denied 頁自己重查。
  if (!permOf(session).read) redirect(deniedUrlFor());
  return session;
}

export async function requireAdmin(returnPath = "/admin"): Promise<TPassClaims> {
  const session = await requireSession(returnPath);
  if (!isAdmin(session)) throw new ForbiddenError();
  return session;
}

export async function requireSuperAdmin(returnPath = "/admin"): Promise<TPassClaims> {
  const session = await requireSession(returnPath);
  if (!isSuperAdmin(session)) throw new ForbiddenError();
  return session;
}
