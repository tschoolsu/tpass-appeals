// 年級推導。屆別的真相在 auth：token 的 entryYear claim（民國入學學年度，
// 含休學復學等人工覆寫）。契約見 tpass-auth/INTEGRATION.md §3.3。
//
// claim 缺席時 fallback 回信箱前三碼——這條是必要的，不是可選的：token TTL 45 分鐘，
// auth 升級後的轉場期使用者手上還是舊 token，少了 fallback 那段時間年級會整批變空白。
//
// 年級 = 現在學年度 − 入學學年度 + 1；學年度每年 8 月跳新。高中三年制，超出範圍回 null
// （老師/職務帳號、已畢業、尚未入學）。

export interface GradeSource {
  email: string;
  entryYear?: number | null;
}

// 信箱前三碼＝民國入學學年度（如 1140001@... → 114）。無數字前綴 → null。
function parseEntryYearFromEmail(email: string): number | null {
  const m = email.match(/^(\d{3})/);
  return m ? Number(m[1]) : null;
}

export function deriveGrade(
  source: GradeSource,
  now: Date = new Date(),
): number | null {
  const entry = source.entryYear ?? parseEntryYearFromEmail(source.email);
  if (entry === null) return null;
  const roc = now.getFullYear() - 1911;
  const academicYear = now.getMonth() + 1 >= 8 ? roc : roc - 1;
  const grade = academicYear - entry + 1;
  return grade >= 1 && grade <= 3 ? grade : null;
}

// 給人看的標籤：1 → 高一、2 → 高二、3 → 高三；其餘原樣回數字字串。
export function gradeLabel(grade: number | null): string | null {
  if (grade === null) return null;
  const zh = ["一", "二", "三"][grade - 1];
  return zh ? `高${zh}` : String(grade);
}
