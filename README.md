# T-Appeals 學生申訴系統

TSchool 學生會的申訴收件系統：學生用學校帳號登入（T-Pass SSO）填申訴表，
內容寫入 PostgreSQL，並貼一則**不含內容**的 Discord 論壇通知給承辦幹部
（姓名·年級 + 時間 + 後台連結 + 附件數量——申訴全文與附件只在有稽核的後台看得到）；
幹部在 `/admin` 管理題目、設定與收件開關。

| 項目 | 值 |
| --- | --- |
| 服務 id | `appeals`（tpass-ops `services.json`） |
| 本機網址 | `https://appeals.lvh.me:3004` |
| 正式網址 | `https://appeals.tschoolsu.org` |
| 資料庫 | PostgreSQL（Prisma，`migrate` 策略，migrations 進 git） |
| SSO | 消費端（契約 v2）：`src/lib/tpass-auth.ts` 驗章，只碰公鑰 |

## 開發

一律從上層 tpass-ops repo 啟動（處理 mkcert / TLS 信任 / 多服務並行）：

```bash
# 上層目錄
scripts/tpass dev appeals     # 或 tpass dev（全部服務）
scripts/tpass check appeals   # push 前：lint + tsc --noEmit
scripts/tpass db setup appeals  # 本機建 t_appeals role/db + prisma migrate
```

單獨跑本服務：`pnpm dev`（package.json 已設好 HTTPS + `appeals.lvh.me:3004`，含
`NODE_TLS_REJECT_UNAUTHORIZED=0`）。env 必填清單以 `src/config/*.ts` 的 `REQUIRED` 為準，
範本見 `.env.example`。

## 結構速記

- `src/app/actions.ts` — 送出申訴（server action；含 30 分鐘冷卻）
- `src/app/admin/` — 題目 / 設定 /（超管）成員管理；每個 action 內部都重呼 guard
- `src/lib/discord.ts` — Discord 論壇 webhook 通知（URL 存 DB，僅限 discord.com；**只送辨識資訊，不送內容**）
- `src/lib/storage.ts` — 檔案上傳（local driver；S3 是待實作 stub）
- Admin 權限 = `SUPER_ADMIN_EMAILS` 種子 ∪ DB Admin 表（不信任 JWT 的 placeholder role）
