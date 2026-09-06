-- STARTING FIVE / 選手交代 / 出場時間 / プラスマイナスの追跡機能

-- 1. チームのデフォルトSTARTING FIVE設定(TEAMタブで編集し、試合作成時にgame_lineupsへ引き継がれる)
alter table players add column if not exists is_starter boolean not null default false;

-- 2. 試合ごとの出場状況(STARTING FIVE / RESERVE、出場時間、プラスマイナス)
create table if not exists game_lineups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  on_court boolean not null default false,
  seconds_played int not null default 0,
  plus_minus int not null default 0,
  unique (game_id, player_id)
);
create index if not exists idx_game_lineups_game on game_lineups(game_id);

alter table game_lineups enable row level security;

create policy "manage own team game_lineups" on game_lineups
  for all
  using (exists (select 1 from games g where g.id = game_lineups.game_id and is_team_member(g.team_id)))
  with check (exists (select 1 from games g where g.id = game_lineups.game_id and is_team_member(g.team_id)));

alter publication supabase_realtime add table game_lineups;

-- 3. 試合作成時、その時点の選手のis_starterを引き継いでgame_lineupsを作成する。
--    誰もSTARTING FIVEに設定されていない場合は並び順で先頭5人を仮のSTARTING FIVEにする。
create or replace function seed_game_lineups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists trg_seed_game_lineups on games;
create trigger trg_seed_game_lineups
  after insert on games
  for each row execute function seed_game_lineups();

-- 4. プラスマイナス: 自チームの得点イベントの記録・取り消し時、その時点でSTARTING FIVE
--    (on_court)の選手全員に加減算する。
create or replace function stat_event_points(stat_key text)
returns int
language sql
immutable
as $$
  select case stat_key
    when 'fg2_make' then 2
    when 'fg3_make' then 3
    when 'ft_make' then 1
    else 0
  end;
$$;

create or replace function apply_stat_event_plus_minus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pts int := stat_event_points(NEW.stat_key);
begin
  if pts > 0 then
    update game_lineups
    set plus_minus = plus_minus + pts
    where game_id = NEW.game_id and on_court = true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_stat_event_plus_minus_ins on stat_events;
create trigger trg_stat_event_plus_minus_ins
  after insert on stat_events
  for each row execute function apply_stat_event_plus_minus();

create or replace function revert_stat_event_plus_minus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pts int := stat_event_points(OLD.stat_key);
begin
  if pts > 0 then
    update game_lineups
    set plus_minus = plus_minus - pts
    where game_id = OLD.game_id and on_court = true;
  end if;
  return OLD;
end;
$$;

drop trigger if exists trg_stat_event_plus_minus_del on stat_events;
create trigger trg_stat_event_plus_minus_del
  after delete on stat_events
  for each row execute function revert_stat_event_plus_minus();

-- 5. 相手の得点(手動カウンター)の増減もSTARTING FIVEのプラスマイナスに反映する
create or replace function apply_opponent_score_plus_minus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := NEW.opponent_score - OLD.opponent_score;
begin
  if delta <> 0 then
    update game_lineups
    set plus_minus = plus_minus - delta
    where game_id = NEW.id and on_court = true;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_opponent_score_plus_minus on games;
create trigger trg_opponent_score_plus_minus
  after update of opponent_score on games
  for each row execute function apply_opponent_score_plus_minus();

-- 6. 出場時間の加算(タイマー進行中、クライアントから数秒おきに呼び出す)
create or replace function increment_lineup_seconds(p_game_id uuid, p_delta int)
returns void
language sql
security definer
set search_path = public
as $$
  update game_lineups
  set seconds_played = seconds_played + p_delta
  where game_id = p_game_id
    and on_court = true
    and exists (select 1 from games g where g.id = p_game_id and is_team_member(g.team_id));
$$;

grant execute on function increment_lineup_seconds(uuid, int) to authenticated;

-- 7. ボックススコア・シーズン成績にプラスマイナスを追加
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
    + count(*) filter (where stat_key = 'ft_make'))                              as pts,
  coalesce((
    select gl.plus_minus from game_lineups gl
    where gl.game_id = stat_events.game_id and gl.player_id = stat_events.player_id
  ), 0)::int as plus_minus
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
  coalesce(sum(pgs.pf), 0)::int     as pf,
  coalesce(sum(pgs.plus_minus), 0)::int as plus_minus
from players p
left join player_game_stats pgs on pgs.player_id = p.id
where p.guest_game_id is null
group by p.id, p.team_id;
