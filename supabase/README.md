# dev-supabase — SaaS 化開發分支

這個分支是現有 app 的**副本**，用來把後端從「使用者自己的 Google Sheets」
改造成「Supabase 雲端資料庫（多租戶）」。`main` / 正式分支完全不受影響。

## 為什麼是這個架構

| 項目 | 現況（Google Sheets） | 本分支（Supabase） |
|------|----------------------|-------------------|
| 資料庫 | 每人自己的試算表 | 共用 Postgres，靠 RLS 隔離各家庭 |
| 登入 | Google OAuth 直連 Sheets（要試算表存取權） | Supabase Auth（Google 登入，只拿身分） |
| 新用戶開通 | 自建試算表＋跑 Apps Script（約十步） | 登入即用 |
| 資安邊界 | 試算表共用權限 | Row-Level Security（見 policies.sql） |

## 哪些程式碼會改、哪些照搬

**照搬（純運算，與資料庫無關，一行都不用改）：**
- `js/store.js` 的計算邏輯：`calcBalance`、`calcAllBalances`、`Utils.cardBills`
  帳單引擎、代付 FIFO、分期分組、專案缺口
- 所有 `pages/*.js` 的畫面與互動
- `css/app.css`、`index.html`

**重寫（資料存取層）：**
- `js/auth.js` — Google OAuth 直連 → Supabase Auth
- `js/api.js` — Sheets REST → supabase-js CRUD
- `js/store.js` 的 `load()` / `save*()` — 資料來源改 Supabase，但**回傳的
  JS 物件形狀（`{id, roleOut, dimension, …}`）保持不變**，下游計算零改動

**新增：**
- `supabase/schema.sql` — 6 張表 + household_id 外鍵 + 約束
- `supabase/policies.sql` — RLS 政策 + 建家庭 RPC
- 匯入工具：把現有 Google Sheets 帳本灌進 Supabase（第一份測試資料）

## 資料模型的關鍵設計

**「登入使用者」與「預算角色」是兩回事**，分成兩張表：
- `household_users`：有 Google 登入的真人（RLS 的判斷依據）。阿熊、綺綺各一列。
- `members`：預算角色（阿熊/綺綺=personal、家用=shared）。家用沒有登入者，
  只存在於 members。

所以「一個家庭 2 個登入、3 個預算角色」的現況能完整對應。

## 設定步驟（需要你操作）

1. 到 https://supabase.com 建立一個免費專案（Region 選 Tokyo/Singapore 較近）
2. 專案 → SQL Editor → 依序貼上執行：
   - `supabase/schema.sql`
   - `supabase/policies.sql`
3. 專案 → Settings → API，複製兩個值給我：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public key**（一長串 JWT，這是設計上可公開的前端金鑰）
4. 專案 → Authentication → Providers → 啟用 Google（貼上你的 Google OAuth
   Client ID / Secret，Supabase 會給你一個 callback URL 要填回 Google Console）

> anon key 放在前端是**設計上正常**的——它只是「請以匿名身分連線」的識別，
> 真正的存取控制全在 RLS。絕不要把 `service_role` key 放進前端。

拿到第 3 步的 URL + anon key 後，我才能接上 `auth.js` / `api.js` / `store.js`
的改寫。在那之前，這個分支只有資料庫設計檔，程式碼與正式版相同。

## 進度

- [x] 建立隔離分支、複製現有程式碼
- [x] 資料表 schema 設計（schema.sql）
- [x] RLS 政策設計（policies.sql）
- [ ] 你建立 Supabase 專案、執行 SQL、提供 URL + anon key
- [ ] 重寫 auth.js（Supabase Auth 登入）
- [ ] 重寫 api.js + store.js 存取層
- [ ] Google Sheets → Supabase 匯入工具
- [ ] 實機測試：新舊兩邊算出的餘額/缺口/應繳必須一致
- [ ] RLS 隔離測試（兩帳號互相讀不到）
