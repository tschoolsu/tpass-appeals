// 申訴冷卻規則：同一人短時間內只收一件，防灌爆 DB 與 Discord 頻道（安全審查 L2）。
//
// 冷卻沒有自己的資料表——它是從「最後一筆未豁免的申訴」推導出來的。管理員在後台
// 放行時，標記那筆申訴的 cooldownWaivedAt，冷卻查詢就會略過它（見 lib/appeals.ts
// 的 findBlockingAppeal）。這樣天然是一次性放行：學生補送的新申訴會產生自己的新冷卻。
//
// 本檔刻意只放純函式、不碰 DB，這樣測得到（vitest 沒有 DB）。查詢在 lib/appeals.ts。

export const COOLDOWN_MS = 30 * 60 * 1000;

/** 冷卻判斷需要的最小欄位；Appeal 與後台的 view model 都符合。 */
export interface CooldownFields {
  submittedAt: Date;
  cooldownWaivedAt: Date | null;
}

export function cooldownEndsAt(submittedAt: Date): Date {
  return new Date(submittedAt.getTime() + COOLDOWN_MS);
}

/** 這筆申訴此刻是否還在擋這個人再送一件。已豁免的永遠不擋。 */
export function isCoolingDown(appeal: CooldownFields, now: Date = new Date()): boolean {
  if (appeal.cooldownWaivedAt !== null) return false;
  return now.getTime() < cooldownEndsAt(appeal.submittedAt).getTime();
}
