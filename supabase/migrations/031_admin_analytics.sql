-- 運営者専用の管理ダッシュボード(/admin)向け。
-- PV/MAU計測・クライアントエラー記録・お問い合わせ種別集計・ログインのレート制限に使う。
-- いずれも追記専用(update/delete用のポリシーは無い=一般ロールからは更新・削除不可)で、
-- 管理ダッシュボードからの読み取りはservice_role(RLSをバイパスする)経由でのみ行う。

-- ページビュー記録(PV/DAU/WAU/MAU計測用)。
-- INSERTはuser_id=auth.uid()必須、team_id指定時は本人がそのチームのメンバーであること
-- (既存のis_team_member関数)も必須とし、他人・他チームになりすました計測値の混入を防ぐ。
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  team_id uuid,
  path text not null check (char_length(path) <= 200)
);

alter table page_views enable row level security;

create policy "insert_own_page_view" on page_views
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (team_id is null or is_team_member(team_id))
  );

create index if not exists page_views_created_at_idx on page_views (created_at);
create index if not exists page_views_user_created_idx on page_views (user_id, created_at);
create index if not exists page_views_path_created_idx on page_views (path, created_at);

-- クライアントエラー記録。個人情報・秘密情報を残さないよう保存項目を必要最低限に絞る
-- (message/stack/path/created_atのみ。クエリパラメータ・トークン・Authorization・
-- フォーム入力内容・APIキー等は保存しない。呼び出し側でも参照しないが、DB側でも
-- 長さ制限をかけて防御する)。user_idはRLSの本人確認のためだけに保持する。
create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  path text check (char_length(path) <= 200),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 2000)
);

alter table client_errors enable row level security;

create policy "insert_own_error" on client_errors
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists client_errors_created_at_idx on client_errors (created_at);

-- お問い合わせの種別・AIステータスをSupabase側にも保存する(Notionとの往復を減らすため)。
-- 既存のai_classified(bool)とは別軸。過去分はnullのまま(集計時は「不明」として扱う)。
alter table contact_submissions add column if not exists inquiry_type text;
alter table contact_submissions add column if not exists ai_status text;

-- /api/admin/loginの簡易レート制限用。IPハッシュ単位で、直近15分の「失敗した」ログイン試行
-- のみを記録する(成功したログインは記録しない=正常な操作でレート制限を消費させない)。
create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ip_hash text not null
);

alter table admin_login_attempts enable row level security;

create index if not exists admin_login_attempts_ip_created_idx on admin_login_attempts (ip_hash, created_at);

-- 以下、管理ダッシュボード集計用のRPC。PostgRESTのcount=exactだけでは
-- distinctな人数集計・日別集計・Storage集計ができないため、それぞれ小さな関数を用意する。
-- すべてservice_role専用(一般ロールからは実行不可)。

create or replace function admin_distinct_user_count(since timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct user_id) from page_views where created_at >= since;
$$;

create or replace function admin_distinct_team_count(since timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct team_id) from page_views where created_at >= since and team_id is not null;
$$;

create or replace function admin_distinct_member_count()
returns bigint
language sql
stable
as $$
  select count(distinct user_id) from team_members;
$$;

create or replace function admin_daily_page_views(since timestamptz)
returns table(day date, count bigint)
language sql
stable
as $$
  select date(created_at at time zone 'Asia/Tokyo') as day, count(*)
  from page_views
  where created_at >= since
  group by 1
  order by 1;
$$;

create or replace function admin_daily_active_users(since timestamptz)
returns table(day date, count bigint)
language sql
stable
as $$
  select date(created_at at time zone 'Asia/Tokyo') as day, count(distinct user_id)
  from page_views
  where created_at >= since
  group by 1
  order by 1;
$$;

create or replace function admin_pv_by_page()
returns table(path text, count bigint)
language sql
stable
as $$
  select path, count(*) from page_views group by 1 order by 2 desc;
$$;

-- storage.objectsはpublicスキーマ外のため、security definerでこの関数の所有者(postgres)の
-- 権限で実行する(既存のis_team_member等と同じ既存パターン)。
create or replace function admin_storage_usage()
returns table(bucket_id text, total_bytes bigint, object_count bigint)
language sql
stable
security definer
set search_path = public, storage
as $$
  select bucket_id, coalesce(sum((metadata->>'size')::bigint), 0), count(*)
  from storage.objects
  group by bucket_id;
$$;

-- Supabaseはpublicスキーマに新規作成された関数へ、デフォルト権限としてanon/authenticatedにも
-- EXECUTEを自動付与する(ALTER DEFAULT PRIVILEGES)。「from public」へのrevokeだけでは
-- anon/authenticatedへの個別付与までは取り消せないため、両ロールからも明示的にrevokeする。
revoke execute on function admin_distinct_user_count(timestamptz) from public, anon, authenticated;
revoke execute on function admin_distinct_team_count(timestamptz) from public, anon, authenticated;
revoke execute on function admin_distinct_member_count() from public, anon, authenticated;
revoke execute on function admin_daily_page_views(timestamptz) from public, anon, authenticated;
revoke execute on function admin_daily_active_users(timestamptz) from public, anon, authenticated;
revoke execute on function admin_pv_by_page() from public, anon, authenticated;
revoke execute on function admin_storage_usage() from public, anon, authenticated;

grant execute on function admin_distinct_user_count(timestamptz) to service_role;
grant execute on function admin_distinct_team_count(timestamptz) to service_role;
grant execute on function admin_distinct_member_count() to service_role;
grant execute on function admin_daily_page_views(timestamptz) to service_role;
grant execute on function admin_daily_active_users(timestamptz) to service_role;
grant execute on function admin_pv_by_page() to service_role;
grant execute on function admin_storage_usage() to service_role;
