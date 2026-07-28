// 授權判斷（契約 v2 Phase 6「permissions claim」；Phase 7 已移除 groups 相容層，全生態只認 permissions）：
// 讀 T-Pass 通行證上的 permissions 章。
//   role: admin（超管，隱含 moderator）/ moderator（一般管理員）/ default（一般使用者）
//   admin      —— 超管專屬功能
//   moderator  —— 一般管理功能
import "server-only";
import { permOf, type TPassClaims } from "@/lib/tpass-auth";

export function isSuperAdmin(session: TPassClaims | null | undefined): boolean {
  return permOf(session).role === "admin";
}

export function isAdmin(session: TPassClaims | null | undefined): boolean {
  if (!session) return false;
  return permOf(session).role !== "default";
}

// warning 管制資訊：restriction==="warning" 時回 reason/until，否則 null。
// 呈現交給各服務自己決定（例如頁面頂部橫幅），本檔只負責解析 claim。
export function warningOf(
  session: TPassClaims | null | undefined,
): { reason?: string; until?: number } | null {
  const perm = permOf(session);
  if (perm.restriction !== "warning") return null;
  return { reason: perm.reason, until: perm.until };
}
