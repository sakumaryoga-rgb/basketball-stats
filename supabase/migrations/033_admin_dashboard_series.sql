-- 管理ダッシュボード(/admin)のグラフに期間切り替え(30日/90日/1年/3年/5年)と
-- 期間に応じた粒度(日別/週別/月別/四半期別)を追加するためのRPC。
-- 031・032は本番適用済みのため変更せず、追加のみ行う。
--
-- 何のために追加するか:
-- admin_active_users_series / admin_page_views_series / admin_games_series:
--   既存のadmin_daily_*系は「日別」固定のため、90日=週別・1年/3年=月別・
--   5年=四半期別といった粒度切り替えに対応できない。date_trunc()の第1引数に
--   granularity('day'/'week'/'month'/'quarter')を渡せる汎用版として追加する
--   (granularityはAPI側で固定の許可リストからのみ渡し、フロントエンドの
--   自由入力を直接SQLに渡すことはしない)。既存のadmin_daily_*系はそのまま残す
--   (未使用になるが変更・削除はしない)。
-- admin_pv_by_page_range:
--   既存のadmin_pv_by_page()は全期間固定のため、選択中の期間だけのページ別PVを
--   出すための期間指定版を追加する。

create or replace function admin_active_users_series(since timestamptz, granularity text)
returns table(bucket date, count bigint)
language sql
stable
as $$
  select date_trunc(granularity, created_at at time zone 'Asia/Tokyo')::date as bucket,
         count(distinct user_id)
  from page_views
  where created_at >= since
  group by 1
  order by 1;
$$;

create or replace function admin_page_views_series(since timestamptz, granularity text)
returns table(bucket date, count bigint)
language sql
stable
as $$
  select date_trunc(granularity, created_at at time zone 'Asia/Tokyo')::date as bucket,
         count(*)
  from page_views
  where created_at >= since
  group by 1
  order by 1;
$$;

create or replace function admin_games_series(since timestamptz, granularity text)
returns table(bucket date, game_type text, count bigint)
language sql
stable
as $$
  select date_trunc(granularity, created_at at time zone 'Asia/Tokyo')::date as bucket,
         game_type,
         count(*)
  from games
  where created_at >= since
  group by 1, 2
  order by 1;
$$;

create or replace function admin_pv_by_page_range(since timestamptz)
returns table(path text, count bigint)
language sql
stable
as $$
  select path, count(*)
  from page_views
  where created_at >= since
  group by 1
  order by 2 desc;
$$;

-- 031・032と同じ理由(Supabaseはpublicスキーマの新規関数へanon/authenticatedにも
-- デフォルトでEXECUTEを付与するため)で、public/anon/authenticatedから明示的にrevokeし、
-- service_roleにのみ許可する。
revoke execute on function admin_active_users_series(timestamptz, text) from public, anon, authenticated;
revoke execute on function admin_page_views_series(timestamptz, text) from public, anon, authenticated;
revoke execute on function admin_games_series(timestamptz, text) from public, anon, authenticated;
revoke execute on function admin_pv_by_page_range(timestamptz) from public, anon, authenticated;

grant execute on function admin_active_users_series(timestamptz, text) to service_role;
grant execute on function admin_page_views_series(timestamptz, text) to service_role;
grant execute on function admin_games_series(timestamptz, text) to service_role;
grant execute on function admin_pv_by_page_range(timestamptz) to service_role;
