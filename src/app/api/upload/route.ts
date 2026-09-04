// 檔案上傳端點：填寫者上傳前先打這裡拿 upload id，再把 id 帶進答案。
// 一律驗 session、檢查目標題確實是 file_upload 題、擋超大檔。
//
// 型別把關**不看 client 給的 file.type**（可任意偽造），改嗅探位元組，並把嗅探
// 結果存進 Upload.mime——這樣新資料的 mime 是可信的。舊資料仍是 client 值，
// 所以 /api/files 的 inline 分支還是會再嗅探一次。
import { NextResponse } from "next/server";
import { tpass } from "@/config/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { newStorageKey, putObject } from "@/lib/storage";
import { sniffImageMime, isPdf } from "@/lib/image";

const MAX_BYTES = 10 * 1024 * 1024;
// 每人每日上傳數上限：擋掉拿上傳端點當免費網路硬碟用（安全審查 M3 在 form
// 已修，appeals 當初漏掉）。以 uploaderSub 計，不分申訴件。
const MAX_UPLOADS_PER_USER_PER_DAY = 30;

export async function POST(request: Request) {
  const session = await tpass.getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.acceptingResponses) {
    return NextResponse.json({ error: "not accepting responses" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const questionId = form.get("questionId");

  if (!(file instanceof File) || typeof questionId !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.type !== "file_upload") {
    return NextResponse.json({ error: "no such file question" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bytes = new Uint8Array(buffer);
  const mime = sniffImageMime(bytes) ?? (isPdf(bytes) ? "application/pdf" : null);
  if (!mime) {
    return NextResponse.json(
      { error: "unsupported file type（只接受 PNG / JPEG / GIF / WebP / PDF）" },
      { status: 415 },
    );
  }

  const storageKey = newStorageKey();

  // 每日上限的「數 + 建」包進同一交易，並用 advisory lock 序列化同一 uploaderSub 的並發
  // 請求——原本 count 再 create 中間沒鎖，並發下能無上限繞過。putObject 是外部 I/O，
  // 不能放進交易：交易只負責鎖 + count + 建 Upload 紀錄，寫檔留到交易 commit 之後；
  // 寫檔失敗就把剛建的紀錄刪掉。
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${session.sub}))`;

      const recentCount = await tx.upload.count({
        where: {
          uploaderSub: session.sub,
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recentCount >= MAX_UPLOADS_PER_USER_PER_DAY) {
        return { ok: false as const };
      }

      const created = await tx.upload.create({
        data: {
          questionId,
          storageKey,
          filename: file.name,
          mime,
          size: file.size,
          uploaderSub: session.sub,
        },
        select: { id: true, filename: true },
      });
      return { ok: true as const, upload: created };
    },
    { timeout: 10_000 },
  );

  if (!result.ok) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }

  try {
    await putObject(storageKey, buffer, mime);
  } catch (e) {
    await prisma.upload.delete({ where: { id: result.upload.id } }).catch((delErr) => {
      console.error(`[upload] putObject 失敗後刪除 Upload ${result.upload.id} 也失敗`, delErr);
    });
    console.error(`[upload] putObject 失敗，已刪除 Upload ${result.upload.id}`, e);
    throw e;
  }

  return NextResponse.json({ id: result.upload.id, filename: result.upload.filename });
}
