# PRD — 家庭財務 SaaS（測試版 / 商轉版）

| | |
|---|---|
| 版本 | 0.1（規劃中，2026-07-06） |
| 分支 | `dev-supabase`（隔離開發，不影響正式版） |
| 後端 | Supabase（Postgres + Auth + RLS + Realtime） |
| 商業模式 | 免費 + 訂閱制（家庭功能付費） |
| 基礎文件 | 產品功能與業務規則沿用正式版 PRD（`claude/review-expense-app-requirements-X6uFt` 分支）；本文件只描述**SaaS 化新增/改變的部分** |
| 技術設定 | 資料表與 RLS 見 `supabase/schema.sql`、`supabase/policies.sql`、`supabase/README.md` |

---

## 1. 為什麼做這版

正式版是「BYO-Sheets」——每位新用戶要自建試算表＋跑 Apps Script（約十步），實質上只有自己家能用。商轉版把後端換成雲端資料庫，讓**登入即用、可多家庭、可收訂閱**，同時保留正式版最有差異化的家庭代付與帳單引擎。

### 定位
- **市場切入點**：不做又一個單人記帳 App；主打「**夫妻/家人共同財務**」——誰欠誰、代付分期、共同帳戶，這是記帳城市/CWMoney 沒解好的痛點。
- **副業試水溫**：先用最小成本驗證「有人願意付月費」，再逐步投入金流與行銷。

## 2. 目標與非目標

**目標**
- 新用戶從登入到記下第一筆 < 3 分鐘（無需任何試算表/技術設定）
- 家庭成員資料嚴格隔離：任何人都讀不到別家的任何一列
- 正式版全部功能與業務規則零損失地沿用
- 驗證訊號：候補/實際付費用戶達到可繼續投入的門檻

**非目標（本階段不做）**
- 銀行/發票自動同步、AI 分類、報稅匯出
- 網頁管理後台、團隊/企業版
- App Store/Play 上架（先 PWA）

## 3. 與正式版的差異總覽

| 面向 | 正式版 | SaaS 版 |
|---|---|---|
| 後端 | 使用者自有 Google 試算表 | Supabase（共用 Postgres，RLS 隔離） |
| 租戶 | 單一家庭 | 多家庭（household） |
| 登入 | Google OAuth（要試算表存取權） | Supabase Auth（Google + Email，只取身分） |
| 開通 | 自建 Sheet + Apps Script | 登入即用 + Onboarding 精靈 |
| 資安邊界 | 試算表共用權限 | Row-Level Security（資料庫層） |
| 資料存取層 | `api.js`（Sheets REST）+ `store.js` load/save | 改寫為 supabase-js；**計算邏輯（store.js 的 calcBalance / cardBills / 代付 / 分期）原封不動** |
| 收費 | 無 | 免費 + 訂閱 |
| 即時同步 | 5 分鐘快取 | Supabase Realtime（家人記帳即時反映） |

> **沿用不變**：總覽/記帳/帳本/帳單/專案/投資 各頁功能、帳單引擎（FIFO）、代付往來、分期、對帳、統計排除規則——皆與正式版一致。

## 4. 使用者與租戶模型

### 4.1 兩層概念（關鍵設計）
- **登入使用者（`household_users`）**：有 Google/Email 登入的真人，是 RLS 判斷依據。
- **預算角色（`members`）**：阿熊/綺綺=personal、家用=shared。**共享角色沒有登入者**，只存在於 members。

→ 支援「一個家庭 2 個登入、3 個預算角色」的現實；也支援單親（1 人＋家用）、多共享空間（家用＋房貸專戶）。

### 4.2 權限
- 家庭建立者為 `owner`，其餘為 `member`；owner 可管理成員與訂閱。
- 所有資料表的讀寫都受 RLS：`is_household_member(household_id)` 為真才可存取。

## 5. 新增功能需求

### 5.1 登入
- Supabase Auth：Google 一鍵登入 + Email/密碼註冊（給無 Google 帳號者）。
- 授權畫面只要求「身分」（email、名字），不碰任何 Google 服務權限。
- 正式版的「Settings 工作表身份同步」機制**移除**——登入身分天生唯一。

### 5.2 Onboarding 精靈（首次登入、查無 household 時觸發）
1. **建立家庭空間並命名** → 呼叫 `create_household` RPC（一次建 household + 把自己加入 household_users 並設 owner）。
2. **新增成員** → 預設帶「你（personal）＋家用（shared）」，可改名/加人。
3. **設定第一個帳戶與餘額**。
4. 進入主畫面開始記帳。

### 5.3 邀請家人
- **測試版做法**：邀請碼（owner 產生 6 位碼，可設過期；家人登入後輸入碼加入）；**第一版可先由 owner 手動加人（後台一列 SQL）** 以最快驗證多人同步。
- 對方登入後選「我是哪個預算角色」，寫入 household_users。
- 安全性：邀請碼一次性/可撤銷；RLS 確保加入前看不到任何資料。

### 5.4 訂閱與付費閘門
- `households.plan`（free / premium）＋前端 `can(feature)` 統一判斷；**閘門同時在資料庫層強制**（如成員數上限由 RLS/約束擋，非只靠前端 flag）。

| 免費版 | 付費版（月費，試價 NT$90–150） |
|---|---|
| 單人 + 1 共享角色 | **成員無上限、多共享空間** |
| 收支/轉帳記帳 | **代付往來 + 一鍵/全額補款**（核心賣點） |
| 當月統計 + 分類圖 | 年度趨勢、分類明細下鑽 |
| — | 信用卡帳單管理、分期 |
| — | 專案預算、投資追蹤、對帳校正 |
| — | CSV / Google Sheets 匯出（＝正式版「資料在自己手上」的安心感） |

> 設計原則：免費版**完整可用但單人**；付費動機＝「拉家人進來」，同時成為傳播機制（1 付費家庭 = 2–4 人幫忙宣傳）。

## 6. 資安（本版最高優先）

- **RLS 是唯一隔離邊界**：anon key 公開，安全 100% 靠 policy；每表 `using/with check (is_household_member(household_id))`。
- **建家庭 RPC** 以 security definer 跨過「新用戶還沒有 household」的雞生蛋問題。
- **上線前必做**：用兩個測試帳號互相嘗試讀/改對方資料，必須全部失敗（見 `policies.sql` 檔尾測試腳本）。
- 金流/成員上限等閘門在 DB 層強制，不信任前端。
- 沿用正式版的 XSS 跳脫、輸入驗證。
- 付費前升 Supabase Pro（每日備份）——別人的財務資料掉了是信任毀滅。
- 台灣個資法基本盤：隱私權政策、帳號＋資料徹底刪除功能。

## 7. 資料模型（Supabase）

6 張表，每張帶 `household_id` 外鍵（詳見 `supabase/schema.sql`）：

| 表 | 對應正式版 | 備註 |
|---|---|---|
| `households` | — | 家庭空間、plan |
| `household_users` | Settings（身份） | 登入者↔家庭↔預算角色，RLS 依據 |
| `members` | Backend V:W | 預算角色（personal/shared） |
| `accounts` | Backend L:T | 帳戶設定 |
| `ledger` | Ledger A:O | **id 保留 app 字串**（分期 `gid-i期數`、settleId 綁定不可改 uuid） |
| `projects` | Projects | 專案/貸款 |
| `investments` | Investments | 持倉 |

- **計算邏輯不動**：讀回組成的 JS 物件形狀（`{id, roleOut, dimension, …}`）與正式版一致，下游 `calcBalance` / `cardBills` / 代付 / 分期 完全沿用。
- **遷移工具**：把現有 Google Sheets 帳本一次性匯入 Supabase（你們家自己是第一個遷移與測試資料集）。

## 8. 商轉路線圖

| 階段 | 內容 | 你要操作 | 成本 |
|---|---|---|---|
| **0 驗證** | Landing page + 社群測水溫、候補名單 | 發布、貼文 | 0 |
| **1 MVP** | Supabase 專案、6 表 + RLS、改寫 auth/api/store、Onboarding、Sheets 匯入 | 建 Supabase 專案、開 Google 登入、給 URL+anon key | 0（免費層） |
| **2 多人** | 邀請碼、成員管理、Realtime | 測試多人同步 | 0 |
| **3 收費** | 付費閘門、藍新金流定期定額、Supabase Pro | 金流帳號（審核 1–2 週）、網域、商業登記/報稅、隱私權政策 | Pro US$25/月 + 網域 + 金流抽成 |

- **10 → 100 用戶不需改程式**，僅打開訂閱＋升 Pro；技術瓶頸在數萬用戶（好問題）。
- 詳細「你要操作的事」清單見對話紀錄；最小起步只需階段 1 的 Supabase + Google 登入（全免費）。

## 9. 里程碑與未定事項

**里程碑**
1. schema + RLS 上線並通過隔離測試 ✅（設計完成，待建專案執行）
2. auth/api/store 改寫，正式版功能全通
3. Sheets → Supabase 匯入，新舊數字比對一致（餘額/缺口/應繳）
4. 多人同步實測
5. 付費閘門 + 金流

**未定事項（Open Questions）**
- 邀請機制最終選型（邀請碼 vs 連結 token vs 指定 email）
- 定價點與免費/付費功能切分的最終版
- 是否提供「自動備份到使用者自己的 Google Sheets」作為付費賣點
- 記帳頁視覺改版（定案版面已設計，正式版與此版共用）

**依賴**：需使用者建立 Supabase 專案並提供 Project URL + anon key，才能開始 §8 階段 1 的程式改寫。
