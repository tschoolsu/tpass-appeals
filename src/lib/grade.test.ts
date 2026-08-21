import { describe, it, expect } from "vitest";
import { deriveGrade, gradeLabel } from "./grade";

const AUTUMN_114 = new Date(2025, 8, 1); // 民國 114 學年度

describe("deriveGrade", () => {
  it("有 entryYear claim 時以它為準（信箱說 114 屆，claim 說 113 屆）", () => {
    expect(
      deriveGrade({ email: "1140001@example.edu.tw", entryYear: 113 }, AUTUMN_114),
    ).toBe(2); // 只看信箱會得到 1，證明 claim 優先
  });

  it("claim 缺（舊 token）時 fallback 回信箱前三碼", () => {
    expect(deriveGrade({ email: "1140001@example.edu.tw" }, AUTUMN_114)).toBe(1);
  });

  it("claim 為 null 時同樣 fallback 回信箱", () => {
    expect(
      deriveGrade({ email: "1130001@example.edu.tw", entryYear: null }, AUTUMN_114),
    ).toBe(2);
  });

  it("休學一年復學：覆寫屆別後從誤判的高二變回高一", () => {
    const autumn115 = new Date(2026, 8, 1); // 民國 115 學年度
    const email = "1140001@example.edu.tw";
    expect(deriveGrade({ email }, autumn115)).toBe(2); // 不修正 → 誤判高二
    expect(deriveGrade({ email, entryYear: 115 }, autumn115)).toBe(1); // 修正後 → 高一
  });

  it("老師／職務帳號 → null", () => {
    expect(deriveGrade({ email: "teacher@example.edu.tw" }, AUTUMN_114)).toBeNull();
  });

  it("已畢業（超出高中三年）→ null", () => {
    expect(deriveGrade({ email: "1100001@example.edu.tw" }, AUTUMN_114)).toBeNull();
  });

  it("尚未入學（未來屆）→ null", () => {
    expect(deriveGrade({ email: "1160001@example.edu.tw" }, AUTUMN_114)).toBeNull();
  });

  it("8 月 1 日跳新學年度：前一天還是高一，當天變高二", () => {
    const email = "1140001@example.edu.tw";
    expect(deriveGrade({ email }, new Date(2026, 6, 31))).toBe(1);
    expect(deriveGrade({ email }, new Date(2026, 7, 1))).toBe(2);
  });
});

describe("gradeLabel", () => {
  it("1/2/3 轉成中文", () => {
    expect(gradeLabel(1)).toBe("高一");
    expect(gradeLabel(2)).toBe("高二");
    expect(gradeLabel(3)).toBe("高三");
  });

  it("null 回 null", () => {
    expect(gradeLabel(null)).toBeNull();
  });
});
