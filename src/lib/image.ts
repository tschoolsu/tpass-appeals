// 上傳檔案的型別嗅探。**唯一可信的 mime 來源**——`Upload.mime` 存的是瀏覽器給的
// `file.type`，上傳者可以任意偽造，所以凡是要 inline 回吐給瀏覽器的場合，
// 一律以本檔的嗅探結果為準，不得沿用 DB 裡那個值（沿用＝同源 stored XSS）。
//
// 只認 raster 格式。SVG 是可執行文件（可內嵌 <script>），沒有消毒手段就不該
// inline，因此這裡永遠不會回傳 SVG。

export const SNIFFABLE_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export type SniffedImageMime = (typeof SNIFFABLE_IMAGE_MIMES)[number];

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

// 嗅不出白名單內的格式就回 null（呼叫端應拒絕 inline）。
export function sniffImageMime(buf: Uint8Array): SniffedImageMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // GIF: "GIF87a" / "GIF89a"
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  // WebP: "RIFF" ....(4 bytes size).... "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

// 給前端用的粗略判斷（只影響要不要試著渲染 <img>，不是安全邊界——
// 真正的把關在 sniffImageMime，而且渲染失敗時 UI 會 fallback 回下載連結）。
export function looksLikeImage(mime: string): boolean {
  return (SNIFFABLE_IMAGE_MIMES as readonly string[]).includes(mime);
}

// PDF: "%PDF-"
export function isPdf(buf: Uint8Array): boolean {
  return startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}
