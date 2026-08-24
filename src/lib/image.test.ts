import { describe, it, expect } from "vitest";
import { sniffImageMime, looksLikeImage, isPdf } from "./image";

const png = (...rest: number[]) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...rest]);
const jpeg = (...rest: number[]) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...rest]);
const gif87 = () => new Uint8Array([...Buffer.from("GIF87a"), 0x00]);
const gif89 = () => new Uint8Array([...Buffer.from("GIF89a"), 0x00]);
const webp = () =>
  new Uint8Array([...Buffer.from("RIFF"), 0x24, 0x00, 0x00, 0x00, ...Buffer.from("WEBP")]);

describe("sniffImageMime", () => {
  it("認得四種白名單格式", () => {
    expect(sniffImageMime(png())).toBe("image/png");
    expect(sniffImageMime(jpeg())).toBe("image/jpeg");
    expect(sniffImageMime(gif87())).toBe("image/gif");
    expect(sniffImageMime(gif89())).toBe("image/gif");
    expect(sniffImageMime(webp())).toBe("image/webp");
  });

  // 這是本模組存在的理由：inline 回吐前必須擋掉偽裝成圖片的可執行內容。
  it("拒絕 SVG（可內嵌 script，永遠不 inline）", () => {
    expect(sniffImageMime(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(sniffImageMime(new Uint8Array(Buffer.from('<?xml version="1.0"?><svg>')))).toBeNull();
  });

  it("拒絕副檔名/宣告偽裝成圖片的 HTML", () => {
    expect(sniffImageMime(new Uint8Array(Buffer.from("<script>alert(1)</script>")))).toBeNull();
    expect(sniffImageMime(new Uint8Array(Buffer.from("<!DOCTYPE html><html>")))).toBeNull();
  });

  it("拒絕空 buffer 與過短 buffer", () => {
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
    expect(sniffImageMime(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  // RIFF 容器不只裝 WebP（也裝 wav/avi），只比對前 4 bytes 會誤判。
  it("RIFF 但不是 WEBP 不算圖片", () => {
    const wav = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WAVE")]);
    expect(sniffImageMime(wav)).toBeNull();
    expect(sniffImageMime(new Uint8Array(Buffer.from("RIFF")))).toBeNull();
  });
});

describe("looksLikeImage", () => {
  it("只認白名單", () => {
    expect(looksLikeImage("image/png")).toBe(true);
    expect(looksLikeImage("image/svg+xml")).toBe(false);
    expect(looksLikeImage("application/pdf")).toBe(false);
    expect(looksLikeImage("")).toBe(false);
  });
});

describe("isPdf", () => {
  it("只認 %PDF- 開頭", () => {
    expect(isPdf(new Uint8Array(Buffer.from("%PDF-1.7\n")))).toBe(true);
    expect(isPdf(new Uint8Array(Buffer.from("%PDF")))).toBe(false); // 少了 dash
    expect(isPdf(new Uint8Array(Buffer.from("<script>")))).toBe(false);
    expect(isPdf(new Uint8Array(0))).toBe(false);
  });
});
