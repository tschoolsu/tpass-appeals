"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import type { AppealSettingsView } from "@/lib/settings";
import { saveSettingsAction, type SettingsResult } from "@/app/admin/settings/actions";
import { Input, Textarea, Label, Switch, Button } from "tpass-ui";

export function SettingsForm({ settings }: { settings: AppealSettingsView }) {
  const [state, action, pending] = useActionState<SettingsResult | null, FormData>(
    saveSettingsAction,
    null,
  );
  const [accepting, setAccepting] = useState(settings.acceptingResponses);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <Label>表單標題</Label>
        <Input name="title" defaultValue={settings.title} required className="mt-2" />
      </div>

      <div>
        <Label>說明文字</Label>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          顯示在申訴表單最上方，讓學生了解申訴流程或注意事項。
        </p>
        <Textarea name="introText" defaultValue={settings.introText} className="mt-2" />
      </div>

      <div className="border-t-2 border-dashed border-foreground/15 pt-4">
        <Label>Discord 論壇 Webhook</Label>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          設定後每筆申訴會自動在該論壇頻道發一則貼文。留空則不發送。
        </p>
        <Input
          type="url"
          name="discordWebhookUrl"
          defaultValue={settings.discordWebhookUrl ?? ""}
          placeholder="https://discord.com/api/webhooks/..."
          className="mt-2"
        />
      </div>

      <div className="flex items-start justify-between gap-3 border-t-2 border-dashed border-foreground/15 pt-4">
        <div>
          <Label>接受申訴</Label>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            關閉後填寫頁停止收件。
          </p>
        </div>
        <Switch checked={accepting} onChange={setAccepting} label="接受申訴" />
        <input type="hidden" name="acceptingResponses" value={accepting ? "on" : "off"} />
      </div>

      {state?.error && (
        <p className="font-mono text-xs font-bold text-destructive">{state.error}</p>
      )}
      {state?.ok && <p className="font-mono text-xs font-bold text-primary">設定已儲存。</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          <Save className="h-4 w-4" /> {pending ? "儲存中…" : "儲存設定"}
        </Button>
      </div>
    </form>
  );
}
