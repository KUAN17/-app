-- ═══════════════════════════════════════════════════════════════════════════
-- Row-Level Security（RLS）—— 多租戶隔離的唯一邊界
--
-- 原則：Supabase 的 anon key 是公開的，資料安全 100% 靠 RLS。
-- 每張表只允許「該資料所屬 household 的成員」讀寫，跨家庭一律拒絕。
--
-- 執行方式：schema.sql 之後，於 SQL Editor 貼上執行。
-- 驗證方式：見檔尾「RLS 測試」註解——務必用兩個測試帳號互相嘗試讀對方資料，
--          必須全部失敗才算通過。
-- ═══════════════════════════════════════════════════════════════════════════

-- 判斷目前登入者（auth.uid()）是否為某家庭的成員。
-- security definer：以函式擁有者權限執行，繞過 household_users 自身的 RLS，
-- 避免遞迴（policy 檢查成員時又觸發成員表的 policy）。
create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_users
    where household_users.household_id = hid
      and household_users.user_id = auth.uid()
  );
$$;

-- 開啟所有表的 RLS
alter table households      enable row level security;
alter table household_users enable row level security;
alter table members         enable row level security;
alter table accounts        enable row level security;
alter table ledger          enable row level security;
alter table projects        enable row level security;
alter table investments     enable row level security;

-- ── households：成員可讀；建立由應用流程處理（見下方 note） ────────────────────
drop policy if exists households_select on households;
create policy households_select on households
  for select using (is_household_member(id));

drop policy if exists households_update on households;
create policy households_update on households
  for update using (is_household_member(id));

-- ── household_users：只看得到自己所屬家庭的成員列 ────────────────────────────
drop policy if exists hu_select on household_users;
create policy hu_select on household_users
  for select using (is_household_member(household_id));

-- 加入家庭（接受邀請）：只能把「自己」加進去，不能替別人加
drop policy if exists hu_insert_self on household_users;
create policy hu_insert_self on household_users
  for insert with check (user_id = auth.uid());

drop policy if exists hu_update on household_users;
create policy hu_update on household_users
  for update using (is_household_member(household_id));

drop policy if exists hu_delete on household_users;
create policy hu_delete on household_users
  for delete using (is_household_member(household_id));

-- ── 資料表通用政策：household 成員可完全讀寫（select/insert/update/delete） ────
-- members / accounts / ledger / projects / investments 共用同一條規則。
do $$
declare t text;
begin
  foreach t in array array['members','accounts','ledger','projects','investments']
  loop
    execute format('drop policy if exists %I_all on %I;', t, t);
    execute format(
      'create policy %I_all on %I for all
         using (is_household_member(household_id))
         with check (is_household_member(household_id));', t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 建立家庭的流程 note：
-- 新使用者第一次登入時沒有任何 household，上面的 households_insert 會擋住
-- （因為 is_household_member 對不存在的家庭回 false）。因此「建立家庭」要用
-- 一個 security definer 的 RPC 函式一次完成：建 household + 把自己加進
-- household_users。這樣才能安全地跨過雞生蛋問題。
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function create_household(household_name text, my_identity text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  insert into households (name) values (household_name) returning id into new_id;
  insert into household_users (household_id, user_id, identity, member_role)
    values (new_id, auth.uid(), my_identity, 'owner');
  return new_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS 測試（上線前必做，於 SQL Editor 以兩個測試使用者分別執行）：
--   1. 使用者 A 建立家庭 X，寫入幾筆 ledger。
--   2. 使用者 B 建立家庭 Y。
--   3. 以 B 的身分 `select * from ledger;` → 必須只看到 Y 的資料，看不到 X。
--   4. 以 B 的身分嘗試 `update ledger set amount=0 where household_id='<X的id>';`
--      → 必須影響 0 列（被 RLS 擋下）。
--   全部符合才算隔離正確。
-- ═══════════════════════════════════════════════════════════════════════════
