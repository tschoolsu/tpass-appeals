// 下載上傳檔：僅限管理員（後台看申訴附件用）。
//
// 預設回 attachment——`upload.mime` 是上傳者可控的 `file.type`，直接 inline 回吐
// 等於同源 stored XSS，而能讀這條端點的只有管理員，session cookie 就在那裡。
// `?inline=1` 是給後台縮圖預覽用的窄門：**重新嗅探位元組**，只有真的是白名單
// raster 格式才 inline，且回嗅探值而非 DB 裡那個字串。
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/tpass-auth";
import { isAdmin } from "@/config/admin";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { sniffImageMime } from "@/lib/image";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await getObject(upload.storageKey);
  if (!body) return NextResponse.json({ error: "gone" }, { status: 410 });

  const bytes = new Uint8Array(body);
  const wantsInline = req.nextUrl.searchParams.get("inline") === "1";

  // 共用的縱深防禦：就算嗅探被繞過，nosniff 擋掉瀏覽器自作聰明的型別推測，
  // CSP sandbox 讓內容失去 same-origin 與 script 執行能力。
  const hardening = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (wantsInline) {
    const sniffed = sniffImageMime(bytes);
    if (!sniffed) {
      // 嗅不出白名單格式就不給 inline。UI 會 fallback 回下載連結。
      return NextResponse.json({ error: "not an inlineable image" }, { status: 415 });
    }
    return new NextResponse(bytes, {
      headers: {
        ...hardening,
        "Content-Type": sniffed,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(upload.filename)}`,
      },
    });
  }

  return new NextResponse(bytes, {
    headers: {
      ...hardening,
      "Content-Type": upload.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.filename)}`,
    },
  });
}
