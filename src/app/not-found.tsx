// 打錯網址時的 404（B4）。在此之前會掉到 Next 預設畫面（英文、沒有本站樣式與出口）。
import type { Metadata } from "next";
import { ErrorPage } from "@/components/ErrorPage";

export const metadata: Metadata = { title: "找不到頁面 — T-Appeals" };

export default function NotFound() {
  return (
    <ErrorPage
      code="404 NOT FOUND"
      title="找不到這個頁面"
      message="你要找的申訴頁面不存在，可能是網址打錯，或這筆申訴已被移除。"
    />
  );
}
