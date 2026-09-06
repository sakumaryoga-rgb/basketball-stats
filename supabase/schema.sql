-- バスケスタッツアプリ: データベーススキーマ
-- Supabaseダッシュボード > SQL Editor に、このファイルの内容をそのまま貼り付けて実行してください。
-- (プロジェクト作成後、1回だけ実行すればOKです)

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. テーブル定義
-- ============================================================

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  number int,
  position text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  opponent_name text not null,
  game_date date not null default current_date,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'final')),
  opponent_score int not null default 0,
  created_at timestamptz not null default now()
);

-- 試合中にタップされたスタッツ1件ごとのイベントログ。
-- ここから各種集計(ボックススコア・シーズン成績)を導出する。
-- 集計列を持つテーブルを都度UPDATEする方式と違い、INSERT/DELETEのみで
-- 完結するため更新の競合(lost update)が起きない。
create table if not exists stat_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  stat_key text not null check (stat_key in (
    'fg2_make', 'fg2_miss', 'fg3_make', 'fg3_miss', 'ft_make', 'ft_miss',
    'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf'
  )),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_stat_events_game on stat_events(game_id);
create index if not exists idx_stat_events_player on stat_events(player_id);

-- ============================================================
-- 2. 「自分の所属チームID」を取得するヘルパー関数
-- ============================================================

create or replace function my_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from team_members where user_id = auth.uid();
$$;

-- ============================================================
-- 3. 集計ビュー(試合ごと・シーズン合計のボックススコア)
--    security_invoker = true で、参照する側(stat_events等)のRLSを
--    そのまま適用させる(ビュー作成者権限で抜け道にならないように)
-- ============================================================

create or replace view player_game_stats
with (security_invoker = true) as
select
  game_id,
  player_id,
  count(*) filter (where stat_key in ('fg2_make', 'fg3_make'))                     as fgm,
  count(*) filter (where stat_key in ('fg2_make', 'fg2_miss', 'fg3_make', 'fg3_miss')) as fga,
  count(*) filter (where stat_key = 'fg3_make')                                   as tpm,
  count(*) filter (where stat_key in ('fg3_make', 'fg3_miss'))                    as tpa,
  count(*) filter (where stat_key = 'ft_make')                                    as ftm,
  count(*) filter (where stat_key in ('ft_make', 'ft_miss'))                      as fta,
  count(*) filter (where stat_key = 'oreb')                                       as oreb,
  count(*) filter (where stat_key = 'dreb')                                       as dreb,
  count(*) filter (where stat_key in ('oreb', 'dreb'))                            as reb,
  count(*) filter (where stat_key = 'ast')                                        as ast,
  count(*) filter (where stat_key = 'stl')                                        as stl,
  count(*) filter (where stat_key = 'blk')                                        as blk,
  count(*) filter (where stat_key = 'tov')                                        as tov,
  count(*) filter (where stat_key = 'pf')                                         as pf,
  (count(*) filter (where stat_key = 'fg2_make') * 2
    + count(*) filter (where stat_key = 'fg3_make') * 3
    + count(*) filter (where stat_key = 'ft_make'))                              as pts
from stat_events
group by game_id, player_id;

create or replace view player_season_stats
with (security_invoker = true) as
select
  p.id as player_id,
  p.team_id,
  count(pgs.game_id)                as games_played,
  coalesce(sum(pgs.pts), 0)::int    as pts,
  coalesce(sum(pgs.fgm), 0)::int    as fgm,
  coalesce(sum(pgs.fga), 0)::int    as fga,
  coalesce(sum(pgs.tpm), 0)::int    as tpm,
  coalesce(sum(pgs.tpa), 0)::int    as tpa,
  coalesce(sum(pgs.ftm), 0)::int    as ftm,
  coalesce(sum(pgs.fta), 0)::int    as fta,
  coalesce(sum(pgs.oreb), 0)::int   as oreb,
  coalesce(sum(pgs.dreb), 0)::int   as dreb,
  coalesce(sum(pgs.reb), 0)::int    as reb,
  coalesce(sum(pgs.ast), 0)::int    as ast,
  coalesce(sum(pgs.stl), 0)::int    as stl,
  coalesce(sum(pgs.blk), 0)::int    as blk,
  coalesce(sum(pgs.tov), 0)::int    as tov,
  coalesce(sum(pgs.pf), 0)::int     as pf
from players p
left join player_game_stats pgs on pgs.player_id = p.id
group by p.id, p.team_id;

-- ============================================================
-- 4. Row Level Security (行レベルセキュリティ)
--    自分の所属チームのデータしか読み書きできないようにする
-- ============================================================

alter table teams enable row level security;
alter table team_members enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table stat_events enable row level security;

create policy "select own team" on teams
  for select using (id = my_team_id());

create policy "select own team members" on team_members
  for select using (team_id = my_team_id());

create policy "manage own team players" on players
  for all
  using (team_id = my_team_id())
  with check (team_id = my_team_id());

create policy "manage own team games" on games
  for all
  using (team_id = my_team_id())
  with check (team_id = my_team_id());

create policy "manage own team stat_events" on stat_events
  for all
  using (
    exists (select 1 from games g where g.id = stat_events.game_id and g.team_id = my_team_id())
  )
  with check (
    exists (select 1 from games g where g.id = stat_events.game_id and g.team_id = my_team_id())
  );

-- ============================================================
-- 5. チーム作成・参加 の RPC 関数
-- ============================================================

create or replace function create_team(team_name text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team teams;
  code text;
begin
  if exists (select 1 from team_members where user_id = auth.uid()) then
    raise exception 'すでにチームに所属しています';
  end if;

  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into teams (name, invite_code) values (team_name, code)
  returning * into new_team;

  insert into team_members (team_id, user_id) values (new_team.id, auth.uid());

  return new_team;
end;
$$;

create or replace function join_team(join_code text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team teams;
begin
  if exists (select 1 from team_members where user_id = auth.uid()) then
    raise exception 'すでにチームに所属しています';
  end if;

  select * into target_team from teams where invite_code = upper(join_code);

  if not found then
    raise exception '招待コードが見つかりません';
  end if;

  insert into team_members (team_id, user_id) values (target_team.id, auth.uid());

  return target_team;
end;
$$;

grant execute on function create_team(text) to authenticated;
grant execute on function join_team(text) to authenticated;

-- ============================================================
-- 6. Realtime を有効化(試合中のスタッツ入力を他メンバーにも即座に反映)
-- ============================================================

alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table stat_events;
