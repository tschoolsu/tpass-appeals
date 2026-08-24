import { describe, it, expect, afterAll } from "vitest";
import * as http from "node:http";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { newStorageKey, putObject } from "./storage";
import { postAppealToDiscord } from "./discord";
import type { QuestionView } from "./questions";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const NOT_IMAGE = Buffer.from("%PDF-1.7\nnot an image");

const keys: string[] = [];
async function stash(buf: Buffer): Promise<string> {
  const key = newStorageKey();
  await putObject(key, buf, "application/octet-stream");
  keys.push(key);
  return key;
}

afterAll(async () => {
  await Promise.all(
    keys.map((k) => fs.rm(path.join(process.cwd(), ".uploads", k), { force: true })),
  );
});

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

const q: QuestionView = {
  id: "q1",
  order: 0,
  type: "paragraph",
  title: "發生什麼事",
  description: null,
  required: true,
  options: null,
};
const answers = { q1: "有人插隊" };
const who = { name: "小明", email: "ming@example.com" };

describe("postAppealToDiscord", () => {
  it("沒有附件時走 JSON", async () => {
    const { contentType, body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, who),
    );
    expect(contentType).toBe("application/json");
    const payload = JSON.parse(body.toString());
    expect(payload.thread_name).toContain("小明");
    expect(payload.embeds[0].description).toContain("有人插隊");
    expect(payload.embeds[0].footer.text).toBe("ming@example.com");
  });

  // 名字只放 thread 標題不夠：轉發、通知、搜尋結果都可能只看到 embed 本體。
  it("embed 頂部寫出申訴人是誰（含年級）", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, { ...who, grade: 2 }),
    );
    expect(JSON.parse(body.toString()).embeds[0].author.name).toBe("小明 · 高二");
  });

  it("推不出年級（老師／已畢業）時只寫名字，不留贅字", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, { ...who, grade: null }),
    );
    expect(JSON.parse(body.toString()).embeds[0].author.name).toBe("小明");
  });

  // 這是本次修復的核心：圖片必須以位元組送進 Discord。塞 URL 是沒用的——
  // /api/files 是 admin cookie 保護的，Discord CDN 抓不到。
  it("有圖片時走 multipart，且真的帶位元組", async () => {
    const key = await stash(PNG);
    const { contentType, body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, who, [{ storageKey: key, filename: "證據.png" }]),
    );
    expect(contentType).toContain("multipart/form-data");
    const raw = body.toString("latin1");
    expect(raw).toContain('name="payload_json"');
    expect(raw).toContain('name="files[0]"');
    expect(body.includes(PNG)).toBe(true); // 位元組原封不動
    // 檔名有非 ASCII，確認有被帶上（FormData 會做 UTF-8 編碼）
    expect(raw).toMatch(/filename=/);
  });

  it("非圖片附件不附加，也不誤報「過大」", async () => {
    const key = await stash(NOT_IMAGE);
    const { contentType, body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, who, [{ storageKey: key, filename: "a.pdf" }]),
    );
    expect(contentType).toBe("application/json");
    const payload = JSON.parse(body.toString());
    expect(payload.embeds[0].description).not.toContain("過大");
  });

  // 檔案不見了（.uploads 被清掉）不能讓通知整個掛掉。
  it("讀不到附件時仍送出通知並註記", async () => {
    const { body } = await captureWebhook((url) =>
      postAppealToDiscord(url, [q], answers, who, [
        { storageKey: "doesnotexist", filename: "gone.png" },
      ]),
    );
    const payload = JSON.parse(body.toString());
    expect(payload.embeds[0].description).toContain("1 個附件");
  });

  it("webhook 掛掉不外拋", async () => {
    await expect(
      postAppealToDiscord("http://127.0.0.1:1/nope", [q], answers, who),
    ).resolves.toBeUndefined();
  });

  it("沒設定 webhook 就什麼都不做", async () => {
    await expect(postAppealToDiscord(null, [q], answers, who)).resolves.toBeUndefined();
  });
});
