// 申訴系統設定（單例列）存取層。
import "server-only";
import { prisma } from "@/lib/db";

const SINGLETON_ID = "singleton";

export interface AppealSettingsView {
  title: string;
  introText: string;
  discordWebhookUrl: string | null;
  acceptingResponses: boolean;
}

// 對應 schema.prisma AppealSettings 的 @default，singleton 列還沒被建出來時當讀值。
// 只有 updateSettings（管理員存檔）才會真的 upsert 出那一列——公開表單頁/送出/上傳
// 每次都會呼叫 getSettings，read 用 upsert 等於把讀流量全變成搶同一列 row lock 的寫入。
const DEFAULT_SETTINGS: AppealSettingsView = {
  title: "學生申訴系統",
  introText: "",
  discordWebhookUrl: null,
  acceptingResponses: true,
};

export async function getSettings(): Promise<AppealSettingsView> {
  const row = await prisma.appealSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  return {
    title: row.title,
    introText: row.introText,
    discordWebhookUrl: row.discordWebhookUrl,
    acceptingResponses: row.acceptingResponses,
  };
}

export interface SettingsPatch {
  title?: string;
  introText?: string;
  discordWebhookUrl?: string | null;
  acceptingResponses?: boolean;
}

export async function updateSettings(patch: SettingsPatch): Promise<void> {
  await prisma.appealSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...patch },
    update: patch,
  });
}
