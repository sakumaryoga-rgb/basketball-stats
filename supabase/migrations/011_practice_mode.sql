-- PRACTICEモード(スクリメージ + シューティング)を追加する。
-- games に game_type を持たせ、公式(official)/スクリメージ(practice)/
-- シューティング(shooting)の3種類を同じテーブルで表現する。
-- 公式スタッツ集計(player_game_stats等)からpractice/shootingを確実に除外することが
-- このマイグレーションの最重要ポイント。

alter table games add column if not exists game_type text not null default 'official'
  check (game_type in ('official', 'practice', 'shooting'));

-- スクリメージ/シューティングには「対戦相手」という概念が無いため必須制約を外す
alter table games alter column opponent_name drop not null;

-- シューティングはSTARTING FIVE/出場時間という概念を持たないため、
-- lineup行を作らずスキップする。
create or replace function seed_game_lineups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.game_type = 'shooting' then
    return new;
  end if;

  insert into game_lineups (game_id, player_id, on_court)
  select new.id, p.id, p.is_starter
  from players p
  where p.team_id = new.team_id and p.guest_game_id is null;

  if not exists (select 1 from game_lineups where game_id = new.id and on_court) then
    update game_lineups
    set on_court = true
    where id in (
      select gl.id from game_lineups gl
      join players p on p.id = gl.player_id
      where gl.game_id = new.id
      order by p.sort_order, p.number
      limit 5
    );
  end if;

  return new;
end;
$$;

-- シューティング練習: ショットの座標ではなく「このゾーンから何本打って何本決めたか」を
-- ゾーン単位でまとめて記録するメモ的なタリー。1本ごとにイベントを作るstat_eventsとは
-- 別テーブルにして、公式集計に一切関与しないようにする。
create table if not exists shooting_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  zone text not null check (zone in (
    'restricted_area', 'paint',
    'mid_range_left', 'mid_range_left_center', 'mid_range_center',
    'mid_range_right_center', 'mid_range_right',
    'left_corner_3', 'right_corner_3',
    'above_break_3_left', 'above_break_3_center', 'above_break_3_right'
  )),
  attempts int not null default 0,
  makes int not null default 0,
  updated_at timestamptz not null default now(),
  unique (game_id, player_id, zone)
);
create index if not exists idx_shooting_entries_game on shooting_entries(game_id);

alter table shooting_entries enable row level security;

create policy "manage own team shooting_entries" on shooting_entries
  for all
  using (exists (select 1 from games g where g.id = shooting_entries.game_id and is_team_member(g.team_id)))
  with check (exists (select 1 from games g where g.id = shooting_entries.game_id and is_team_member(g.team_id)));

-- 試投数/成功数の加算(読み取り→書き込みの競合を避けるためupsert+incrementをDB側で行う)
create or replace function increment_shooting_entry(p_game_id uuid, p_player_id uuid, p_zone text, p_attempts int, p_makes int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from games g where g.id = p_game_id and is_team_member(g.team_id)) then
    raise exception 'permission denied';
  end if;

  insert into shooting_entries (game_id, player_id, zone, attempts, makes)
  values (p_game_id, p_player_id, p_zone, p_attempts, p_makes)
  on conflict (game_id, player_id, zone)
  do update set
    attempts = shooting_entries.attempts + excluded.attempts,
    makes = shooting_entries.makes + excluded.makes,
    updated_at = now();
end;
$$;

grant execute on function increment_shooting_entry(uuid, uuid, text, int, int) to authenticated;

-- player_game_stats を「公式試合のみ」に限定する。これが無いと、これから作る
-- スクリメージのイベントが公式のシーズン成績に混ざってしまう。
create or replace view player_game_stats
with (security_invoker = true) as
select
  se.game_id,
  se.player_id,
  count(*) filter (where se.stat_key in ('fg2_make', 'fg3_make'))                     as fgm,
  count(*) filter (where se.stat_key in ('fg2_make', 'fg2_miss', 'fg3_make', 'fg3_miss')) as fga,
  count(*) filter (where se.stat_key = 'fg3_make')                                   as tpm,
  count(*) filter (where se.stat_key in ('fg3_make', 'fg3_miss'))                    as tpa,
  count(*) filter (where se.stat_key = 'ft_make')                                    as ftm,
  count(*) filter (where se.stat_key in ('ft_make', 'ft_miss'))                      as fta,
  count(*) filter (where se.stat_key = 'oreb')                                       as oreb,
  count(*) filter (where se.stat_key = 'dreb')                                       as dreb,
  count(*) filter (where se.stat_key in ('oreb', 'dreb'))                            as reb,
  count(*) filter (where se.stat_key = 'ast')                                        as ast,
  count(*) filter (where se.stat_key = 'stl')                                        as stl,
  count(*) filter (where se.stat_key = 'blk')                                        as blk,
  count(*) filter (where se.stat_key = 'tov')                                        as tov,
  count(*) filter (where se.stat_key = 'pf')                                         as pf,
  (count(*) filter (where se.stat_key = 'fg2_make') * 2
    + count(*) filter (where se.stat_key = 'fg3_make') * 3
    + count(*) filter (where se.stat_key = 'ft_make'))                              as pts,
  coalesce((
    select gl.plus_minus from game_lineups gl
    where gl.game_id = se.game_id and gl.player_id = se.player_id
  ), 0)::int as plus_minus,
  coalesce((
    select gl.seconds_played from game_lineups gl
    where gl.game_id = se.game_id and gl.player_id = se.player_id
  ), 0)::int as seconds_played
from stat_events se
join games g on g.id = se.game_id
where g.game_type = 'official'
group by se.game_id, se.player_id;

-- スクリメージ(practice)専用のボックススコア集計。player_game_stats と同じ列構成。
create or replace view player_practice_game_stats
with (security_invoker = true) as
select
  se.game_id,
  se.player_id,
  count(*) filter (where se.stat_key in ('fg2_make', 'fg3_make'))                     as fgm,
  count(*) filter (where se.stat_key in ('fg2_make', 'fg2_miss', 'fg3_make', 'fg3_miss')) as fga,
  count(*) filter (where se.stat_key = 'fg3_make')                                   as tpm,
  count(*) filter (where se.stat_key in ('fg3_make', 'fg3_miss'))                    as tpa,
  count(*) filter (where se.stat_key = 'ft_make')                                    as ftm,
  count(*) filter (where se.stat_key in ('ft_make', 'ft_miss'))                      as fta,
  count(*) filter (where se.stat_key = 'oreb')                                       as oreb,
  count(*) filter (where se.stat_key = 'dreb')                                       as dreb,
  count(*) filter (where se.stat_key in ('oreb', 'dreb'))                            as reb,
  count(*) filter (where se.stat_key = 'ast')                                        as ast,
  count(*) filter (where se.stat_key = 'stl')                                        as stl,
  count(*) filter (where se.stat_key = 'blk')                                        as blk,
  count(*) filter (where se.stat_key = 'tov')                                        as tov,
  count(*) filter (where se.stat_key = 'pf')                                         as pf,
  (count(*) filter (where se.stat_key = 'fg2_make') * 2
    + count(*) filter (where se.stat_key = 'fg3_make') * 3
    + count(*) filter (where se.stat_key = 'ft_make'))                              as pts,
  coalesce((
    select gl.plus_minus from game_lineups gl
    where gl.game_id = se.game_id and gl.player_id = se.player_id
  ), 0)::int as plus_minus,
  coalesce((
    select gl.seconds_played from game_lineups gl
    where gl.game_id = se.game_id and gl.player_id = se.player_id
  ), 0)::int as seconds_played
from stat_events se
join games g on g.id = se.game_id
where g.game_type = 'practice'
group by se.game_id, se.player_id;

-- Realtime(シューティング入力を他メンバーにも即座に反映)
alter publication supabase_realtime add table shooting_entries;
