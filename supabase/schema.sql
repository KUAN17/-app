-- ═══════════════════════════════════════════════════════════════════════════
-- 家庭財務 App — Supabase 資料庫結構（階段 B：SaaS 化）
-- 對應現有 Google Sheets：Ledger / Projects / Investments / Backend(L:T, V:W)
--
-- 執行方式：Supabase 專案 → SQL Editor → 貼上本檔案執行。
-- 之後再執行 policies.sql 套用 RLS。
-- ═══════════════════════════════════════════════════════════════════════════

-- 讓 gen_random_uuid() 可用（Supabase 預設已啟用 pgcrypto，保險起見）
create extension if not exists pgcrypto;

-- ── households：家庭空間（多租戶的最上層單位） ───────────────────────────────
create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan       text not null default 'free',   -- 'free' | 'premium'（付費閘門用）
  created_at timestamptz not null default now()
);

-- ── household_users：登入帳號 ↔ 家庭 的授權對應（RLS 的判斷依據） ─────────────
-- 一個 auth 使用者（Google 登入）屬於某個家庭，並對應到一個「預算角色」(identity)。
-- 注意：這裡的 user 是「有登入的真人」；家用等共享角色沒有登入，不在此表。
create table if not exists household_users (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  identity     text,                            -- 對應的預算角色名（如 '阿熊'），可為 null（尚未選）
  member_role  text not null default 'member',  -- 'owner' | 'member'（家庭內權限，非預算角色）
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ── members：預算角色（＝現有 Backend V:W 的成員清單） ────────────────────────
-- 阿熊/綺綺=personal，家用=shared。與 household_users 是兩回事：
-- personal 角色通常對應一個登入者，shared 角色（家用）沒有登入者。
create table if not exists members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  type         text not null default 'personal',  -- 'personal' | 'shared'
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (household_id, name)
);

-- ── accounts：帳戶（＝現有 Backend L:T） ─────────────────────────────────────
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  role_name       text not null,                 -- 所屬預算角色名（對應 members.name）
  name            text not null,
  type            text not null default '銀行',   -- 現金 | 銀行 | 信用卡 | 證券帳戶
  initial_balance numeric not null default 0,     -- 期初餘額（信用卡不適用）
  base_date       date,                            -- 基準日（信用卡不適用）
  purpose         text default '',
  billing_date    int default 0,                   -- 信用卡結帳日（每月幾號）
  due_date        int default 0,                   -- 信用卡繳費截止日
  payment_account text default '',                 -- 信用卡綁定扣款帳戶
  created_at      timestamptz not null default now(),
  unique (household_id, role_name, name)
);

-- ── ledger：帳本（＝現有 Ledger 15 欄） ──────────────────────────────────────
-- id 沿用 app 產生的字串（如 'mabc123' 或分期 'mabc123-i3'）——分期分組與
-- settle_id 綁定都依賴這個 id 前綴，不可改用 uuid。
create table if not exists ledger (
  id           text not null,                      -- app 產生（base36 / 分期 gid-iN）
  household_id uuid not null references households(id) on delete cascade,
  role_out     text not null default '',           -- 角色(出)
  dimension    text not null default '日常',        -- 日常 | 專案
  project_tag  text not null default '',
  type         text not null,                       -- 支出 | 收入 | 轉帳
  category     text not null default '',
  memo         text not null default '',
  date         date not null,
  amount       numeric not null check (amount >= 0),
  account_out  text not null default '',
  role_in      text not null default '',            -- 角色(入)，轉帳用
  account_in   text not null default '',
  pay_role     text not null default '',            -- 代付角色
  pay_account  text not null default '',            -- 代付帳戶
  settle_id    text not null default '',            -- 補款結清的支出 id
  created_at   timestamptz not null default now(),
  primary key (household_id, id)                    -- id 僅在同家庭內唯一即可
);
create index if not exists ledger_household_date_idx on ledger (household_id, date);
create index if not exists ledger_household_project_idx on ledger (household_id, project_tag);

-- ── projects：專案／貸款計畫（＝現有 Projects） ──────────────────────────────
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  status          text not null default '進行中',   -- 進行中 | 已結案
  name            text not null,
  budget          numeric not null default 0,
  monthly_payment numeric not null default 0,       -- 貸款月供（>0 視為貸款）
  annual_rate     numeric not null default 0,
  loan_start_date text default '',
  total_periods   int not null default 0,
  owner_role      text default '',                  -- 費用歸屬角色
  default_account text default '',
  created_at      timestamptz not null default now(),
  unique (household_id, name)
);

-- ── investments：投資部位（＝現有 Investments） ──────────────────────────────
create table if not exists investments (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  role         text not null default '',
  account      text not null default '',
  ticker       text not null default '',
  name         text not null default '',
  shares       numeric not null default 0,
  avg_cost     numeric not null default 0,
  price        numeric not null default 0,          -- 即時報價（前端更新，或未來後端排程）
  created_at   timestamptz not null default now()
);
