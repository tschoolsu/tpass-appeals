import { describe, it, expect } from "vitest";
import { COOLDOWN_MS, cooldownEndsAt, isCoolingDown } from "./cooldown";

const T0 = new Date("2026-08-24T10:00:00Z");
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);

describe("cooldownEndsAt", () => {
  it("送出時間 + 冷卻長度", () => {
    expect(cooldownEndsAt(T0).getTime()).toBe(T0.getTime() + COOLDOWN_MS);
  });
});

describe("isCoolingDown", () => {
  const fresh = { submittedAt: T0, cooldownWaivedAt: null };

  it("視窗內、未豁免 → 冷卻中", () => {
    expect(isCoolingDown(fresh, at(COOLDOWN_MS - 1))).toBe(true);
  });

  it("視窗內、已豁免 → 不冷卻（管理員放行）", () => {
    const waived = { submittedAt: T0, cooldownWaivedAt: at(60_000) };
    expect(isCoolingDown(waived, at(COOLDOWN_MS - 1))).toBe(false);
  });

  it("視窗外 → 不冷卻", () => {
    expect(isCoolingDown(fresh, at(COOLDOWN_MS + 1))).toBe(false);
  });

  it("邊界：剛好到期 → 不冷卻", () => {
    expect(isCoolingDown(fresh, at(COOLDOWN_MS))).toBe(false);
  });

  it("邊界：剛送出 → 冷卻中", () => {
    expect(isCoolingDown(fresh, T0)).toBe(true);
  });
});
