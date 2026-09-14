-- 管理ダッシュボード(/admin)のグラフ・前期間比表示のための追加RPC。
-- 031_admin_analytics.sqlは本番適用済みのため変更せず、追加のみ行う。
--
-- 何のために追加するか:
-- 1. admin_distinct_user_count_range / admin_distinct_team_count_range:
--    MAU「前月比」・アクティブチーム数「直近30日比」を出すには、
--    「ある期間"だけ"(開始〜終了)」のdistinctユーザー/チーム数が必要。
--    既存のadmin_distinct_user_count/admin_distinct_team_count(since)は
--    「since以降ずっと(上限なし)」しか計算できないため、上限(until)を
--    指定できる別関数として追加する(既存関数はそのまま・未変更)。
-- 2. admin_daily_games_by_type:
--    試合/練習/シューティングの日別件数推移(積み上げ棒グラフ)は、
--    gamesテーブルを日付×game_type別に集計する必要があり、既存RPCには無い。

create or replace function admin_distinct_user_count_range(since timestamptz, until timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct user_id)
  from page_views
  where created_at >= since and created_at < until;
$$;

create or replace function admin_distinct_team_count_range(since timestamptz, until timestamptz)
returns bigint
language sql
stable
as $$
  select count(distinct team_id)
  from page_views
  where created_at >= since and created_at < until and team_id is not null;
$$;

create or replace function admin_daily_games_by_type(since timestamptz)
returns table(day date, game_type text, count bigint)
language sql
stable
as $$
  select date(created_at at time zone 'Asia/Tokyo') as day, game_type, count(*)
  from games
  where created_at >= since
  group by 1, 2
  order by 1;
$$;

-- 031と同じ理由(Supabaseはpublicスキーマの新規関数へanon/authenticatedにも
-- デフォルトでEXECUTEを付与するため)で、public/anon/authenticatedから明示的にrevokeし、
-- service_roleにのみ許可する。
revoke execute on function admin_distinct_user_count_range(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function admin_distinct_team_count_range(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function admin_daily_games_by_type(timestamptz) from public, anon, authenticated;

grant execute on function admin_distinct_user_count_range(timestamptz, timestamptz) to service_role;
grant execute on function admin_distinct_team_count_range(timestamptz, timestamptz) to service_role;
grant execute on function admin_daily_games_by_type(timestamptz) to service_role;
