"use server";

// 送出申訴。身分一律由伺服器從驗章後的 session 戳記帶入（一律具名，不做匿名分支）。
import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { listQuestions } from "@/lib/questions";
import { findBlockingAppeal } from "@/lib/appeals";
import { COOLDOWN_MS } from "@/lib/cooldown";
import { validateAnswers, collectUploadIds, type AnswerMap } from "@/lib/answers";
import { getSettings } from "@/lib/settings";
import { deriveGrade } from "@/lib/grade";
import { postAppealToDiscord } from "@/lib/discord";
import { authConfig } from "@/config/auth";

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string>;
  message?: string;
}

export async function submitAppealAction(answers: AnswerMap): Promise<SubmitResult> {
  const session = await requireSession("/");
  const settings = await getSettings();
  if (!settings.acceptingResponses) {
    return { ok: false, message: "申訴系統目前沒有開放收件。" };
  }

  const questions = await listQuestions();
  if (questions.length === 0) {
    return { ok: false, message: "表單尚未設定題目，請聯繫學生會。" };
  }

  const fieldErrors = validateAnswers(questions, answers);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, errors: fieldErrors, message: "有題目尚未完成。" };
  }

  // 附件引用一律回查 DB 並綁 uploaderSub——答案 JSON 是 client 送來的，
  // 沒有這一關就能偽造 id、或引用別人上傳的檔案。
  const uploadIds = collectUploadIds(answers);
  const uploads = uploadIds.length
    ? await prisma.upload.findMany({
        where: { id: { in: uploadIds }, uploaderSub: session.sub },
        select: { id: true },
      })
    : [];
  if (uploads.length !== new Set(uploadIds).size) {
    return { ok: false, message: "附件無效或已失效，請重新上傳。" };
  }

  // 冷卻：同一人短時間內只收一件，防灌爆 DB 與 Discord 頻道（安全審查 L2）。
  // 用最近一筆未豁免申訴的時間判斷，免加表；規則見 lib/cooldown.ts。
  // 極端並發下的毫秒級競態可容忍（頂多多一件）。
  const blocking = await findBlockingAppeal(session.sub);
  if (blocking) {
    return {
      ok: false,
      message: `剛剛已送出過申訴，請稍後再試（每 ${COOLDOWN_MS / 60_000} 分鐘限一件）。`,
    };
  }

  const respondentName = session.name;
  const respondentEmail = session.email;
  const respondentGrade = deriveGrade(session);

  // DB 為唯一真相來源／備份，永遠先寫這筆——Discord 通知失敗不影響這裡的結果。
  const appeal = await prisma.appeal.create({
    data: {
      respondentSub: session.sub,
      respondentName,
      respondentEmail,
      respondentGrade,
      answers: answers as Prisma.InputJsonValue,
    },
  });

  // 通知只帶辨識資訊與後台連結，內容與附件一律不出境（加固計畫 A4，理由見 lib/discord.ts）。
  await postAppealToDiscord(
    settings.discordWebhookUrl,
    `${authConfig.selfUrl}/admin/appeals/${appeal.id}`,
    { name: respondentName, email: respondentEmail, grade: respondentGrade },
    uploads.length,
  );

  return { ok: true };
}
