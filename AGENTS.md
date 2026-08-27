# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# tpass-appeals（T-Appeals 學生申訴）

學生填申訴 → 寫 DB + 通知 Discord 論壇頻道（**只通知，內容不出境**，見鐵律）。生態系總覽、`services.json` 註冊表與
`tpass` CLI 見上層 **tpass-ops** repo（`AGENTS.md`、`docs/`）。

## 鐵律

- 本機跑 `pnpm dev`（已設好 HTTPS + `appeals.lvh.me:3004` + `NODE_TLS_REJECT_UNAUTHORIZED=0`；憑證在 `$HOME/tpass-certs`）。檢查用 `pnpm lint` + `pnpm exec tsc --noEmit`。
- UI 一律 light-only Neobrutalism + OKLCH，照 `tpass-portal/docs/design.md`。
- SSO 驗章照 `src/lib/tpass-auth.ts`（契約 v2），四鐵則（EdDSA 鎖定 / issuer / audience=tpass:appeals / exp）不可動；只碰公鑰，絕不 import auth 的私鑰。
- 網域 / issuer / audience / DB 連線全 env 驅動（`src/config/auth.ts`），不寫死。
- Discord webhook URL 內含 secret：只存 DB（/admin/settings），限 `discord.com`／`discordapp.com`，不進 git / log。
- 🚫 **Discord 通知只送辨識資訊，不送內容**（姓名·年級 + 時間 + 後台深連結 + 附件「數量」）。不要把申訴全文、email、檔名或附件加回去——頻道成員名單不在 T-Pass 權限模型裡，沒有稽核也沒有保留政策。理由寫在 `src/lib/discord.ts` 檔頭，`discord.test.ts` 有一條對整包 request body 的斷言在擋。
- 每個 server action / route handler 內部都要重呼 `require*` guard（`src/lib/guard.ts`），不能只靠 layout 擋。
- Schema 變更走 migration（migrations 進 git）；部署端 `deploy.sh` 跑 `prisma migrate deploy`。
