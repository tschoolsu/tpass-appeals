import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
const isAdmin = vi.fn();
const findUnique = vi.fn();
const getObject = vi.fn();

vi.mock("@/lib/tpass-auth", () => ({ getSession: () => getSession() }));
vi.mock("@/config/admin", () => ({ isAdmin: (s: unknown) => isAdmin(s) }));
vi.mock("@/lib/db", () => ({ prisma: { upload: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/storage", () => ({ getObject: (k: string) => getObject(k) }));

const { GET } = await import("./route");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Ctx = Parameters<typeof GET>[1];
const ctx = (id = "u1") => ({ params: Promise.resolve({ id }) }) as Ctx;
const req = (qs = "") => new NextRequest(`https://appeals.test/api/files/u1${qs}`);

function upload(over: Partial<{ mime: string; filename: string }> = {}) {
  return { id: "u1", storageKey: "k1", mime: "image/png", filename: "a.png", ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ sub: "s1" });
  isAdmin.mockReturnValue(true);
  findUnique.mockResolvedValue(upload());
  getObject.mockResolvedValue(PNG);
});

describe("GET /api/files/[id]", () => {
  it("未登入 / 非管理員一律 403", async () => {
    getSession.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(403);

    getSession.mockResolvedValue({ sub: "s1" });
    isAdmin.mockReturnValue(false);
    expect((await GET(req(), ctx())).status).toBe(403);
  });

  it("inline 分支同樣受授權保護（不能被繞過）", async () => {
    isAdmin.mockReturnValue(false);
    expect((await GET(req("?inline=1"), ctx())).status).toBe(403);
  });

  it("找不到 row 回 404，檔案不見回 410", async () => {
    findUnique.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(404);

    findUnique.mockResolvedValue(upload());
    getObject.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(410);
  });

  it("預設回 attachment，且沿用 DB 的 mime（行為不變）", async () => {
    findUnique.mockResolvedValue(upload({ mime: "application/pdf", filename: "報告.pdf" }));
    const res = await GET(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("真圖片 ?inline=1 回 inline，且 Content-Type 是嗅探值", async () => {
    // DB 裡的 mime 故意寫錯，確認回的是嗅探結果而不是它
    findUnique.mockResolvedValue(upload({ mime: "image/gif" }));
    const res = await GET(req("?inline=1"), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
  });

  // 這條是整個 inline 功能的存在前提：Upload.mime 是上傳者可控的 file.type，
  // 沿用它做 inline 就是同源 stored XSS，而受害者正是管理員。
  it("副檔名與 mime 都偽裝成圖片的 script 必須被擋成 415", async () => {
    findUnique.mockResolvedValue(upload({ mime: "image/png", filename: "evil.png" }));
    getObject.mockResolvedValue(Buffer.from("<script>alert(document.cookie)</script>"));
    const res = await GET(req("?inline=1"), ctx());
    expect(res.status).toBe(415);
  });

  it("SVG 永遠不 inline（可內嵌 script）", async () => {
    findUnique.mockResolvedValue(upload({ mime: "image/svg+xml", filename: "x.svg" }));
    getObject.mockResolvedValue(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    );
    expect((await GET(req("?inline=1"), ctx())).status).toBe(415);

    // 但一般下載仍然可以（帶 attachment，瀏覽器不會執行）
    expect((await GET(req(), ctx())).status).toBe(200);
  });
});
