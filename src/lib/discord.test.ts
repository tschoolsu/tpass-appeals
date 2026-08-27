import { describe, it, expect } from "vitest";
import * as http from "node:http";
import { postAppealToDiscord } from "./discord";

// 起一個假 webhook，把收到的請求原樣攔下來。
async function captureWebhook(
  run: (url: string) => Promise<void>,
): Promise<{ contentType: string; body: Buffer }> {
  const captured: { contentType: string; body: Buffer }[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      captured.push({
        contentType: req.headers["content-type"] ?? "",
        body: Buffer.concat(chunks),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  try {
    await run(`http://127.0.0.1:${port}/webhook`);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  expect(captured).toHaveLength(1);
  return captured[0];
}

const APPEAL_URL = "https://appeals.example.org/admin/appeals/abc123";
const who = { name: "小明", email: "ming@example.com" };

describe("postAppealToDiscord", () => {
  it("只送辨識資訊與後台連結", async () => {
    const { contentType, body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, who),
    );
    expect(contentType).toBe("application/json");
    const payload = JSON.parse(body.toString());
    expect(payload.thread_name).toContain("小明");
    expect(payload.embeds[0].description).toContain(APPEAL_URL);
  });

  // A4 的核心保證：Discord 頻道的成員不在 T-Pass 權限模型裡，內容不能出境。
  // 這個測試直接對整包 request 斷言，繞過欄位結構——之後不管誰加了什麼欄位都擋得住。
  it("申訴內容與 email 一律不出現在送出的東西裡", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, who, 2),
    );
    const raw = body.toString();
    expect(raw).not.toContain("ming@example.com");
    expect(raw).not.toContain("有人插隊"); // 申訴內容根本沒有機會被傳進來
    expect(raw).not.toContain("footer");
  });

  it("永遠走 JSON，不再有 multipart 附件路徑", async () => {
    const { contentType, body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, who, 3),
    );
    expect(contentType).toBe("application/json");
    expect(body.toString()).not.toContain("payload_json");
  });

  it("有附件只報數量，不報檔名", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, who, 3),
    );
    expect(JSON.parse(body.toString()).embeds[0].description).toContain("3 個附件");
  });

  it("沒有附件時不提附件", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, who, 0),
    );
    expect(JSON.parse(body.toString()).embeds[0].description).not.toContain("附件");
  });

  // 名字只放 thread 標題不夠：轉發、通知、搜尋結果都可能只看到 embed 本體。
  it("embed 頂部寫出申訴人是誰（含年級）", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, { ...who, grade: 2 }),
    );
    expect(JSON.parse(body.toString()).embeds[0].author.name).toBe("小明 · 高二");
  });

  it("推不出年級（老師／已畢業）時只寫名字，不留贅字", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, APPEAL_URL, { ...who, grade: null }),
    );
    expect(JSON.parse(body.toString()).embeds[0].author.name).toBe("小明");
  });

  it("webhook 掛掉不外拋", async () => {
    await expect(
      postAppealToDiscord("http://127.0.0.1:1/nope", APPEAL_URL, who),
    ).resolves.toBeUndefined();
  });

  it("沒設定 webhook 就什麼都不做", async () => {
    await expect(postAppealToDiscord(null, APPEAL_URL, who)).resolves.toBeUndefined();
  });
});
