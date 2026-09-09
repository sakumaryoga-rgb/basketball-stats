-- 従来のplayer_game_stats/player_practice_game_statsはstat_eventsを起点に集計していたため、
-- 「試合に出場したが1つもスタッツを記録しなかった選手」がその試合の行自体を持たず、
-- ボックススコアに出てこない・試合数(games_played)にもカウントされない・1試合平均が
-- 実際より少ない試合数で計算される、という不具合があった。
-- game_lineups(試合作成時にチームの全選手分の行が作成され、出場時間はプレーした選手のみ
-- 増加する)をもう一方の起点にし、「stat_eventsがある」または「出場時間(seconds_played)が
-- 1秒でもある」選手を対象に含めるFULL OUTER JOINへ変更する。

create or replace view player_game_stats
with (security_invoker = true) as
with se_agg as (
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
      + count(*) filter (where se.stat_key = 'ft_make'))                              as pts
  from stat_events se
  join games g on g.id = se.game_id and g.game_type = 'official'
  group by se.game_id, se.player_id
),
lineup_official as (
  select gl.*
  from game_lineups gl
  join games g on g.id = gl.game_id and g.game_type = 'official'
)
select
  coalesce(a.game_id, l.game_id) as game_id,
  coalesce(a.player_id, l.player_id) as player_id,
  coalesce(a.fgm, 0) as fgm,
  coalesce(a.fga, 0) as fga,
  coalesce(a.tpm, 0) as tpm,
  coalesce(a.tpa, 0) as tpa,
  coalesce(a.ftm, 0) as ftm,
  coalesce(a.fta, 0) as fta,
  coalesce(a.oreb, 0) as oreb,
  coalesce(a.dreb, 0) as dreb,
  coalesce(a.reb, 0) as reb,
  coalesce(a.ast, 0) as ast,
  coalesce(a.stl, 0) as stl,
  coalesce(a.blk, 0) as blk,
  coalesce(a.tov, 0) as tov,
  coalesce(a.pf, 0) as pf,
  coalesce(a.pts, 0) as pts,
  coalesce(l.plus_minus, 0)::int as plus_minus,
  coalesce(l.seconds_played, 0)::int as seconds_played
from se_agg a
full outer join lineup_official l
  on l.game_id = a.game_id and l.player_id = a.player_id
where coalesce(l.seconds_played, 0) > 0 or a.player_id is not null;

create or replace view player_practice_game_stats
with (security_invoker = true) as
with se_agg as (
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
      + count(*) filter (where se.stat_key = 'ft_make'))                              as pts
  from stat_events se
  join games g on g.id = se.game_id and g.game_type = 'practice'
  group by se.game_id, se.player_id
),
lineup_practice as (
  select gl.*
  from game_lineups gl
  join games g on g.id = gl.game_id and g.game_type = 'practice'
)
select
  coalesce(a.game_id, l.game_id) as game_id,
  coalesce(a.player_id, l.player_id) as player_id,
  coalesce(a.fgm, 0) as fgm,
  coalesce(a.fga, 0) as fga,
  coalesce(a.tpm, 0) as tpm,
  coalesce(a.tpa, 0) as tpa,
  coalesce(a.ftm, 0) as ftm,
  coalesce(a.fta, 0) as fta,
  coalesce(a.oreb, 0) as oreb,
  coalesce(a.dreb, 0) as dreb,
  coalesce(a.reb, 0) as reb,
  coalesce(a.ast, 0) as ast,
  coalesce(a.stl, 0) as stl,
  coalesce(a.blk, 0) as blk,
  coalesce(a.tov, 0) as tov,
  coalesce(a.pf, 0) as pf,
  coalesce(a.pts, 0) as pts,
  coalesce(l.plus_minus, 0)::int as plus_minus,
  coalesce(l.seconds_played, 0)::int as seconds_played
from se_agg a
full outer join lineup_practice l
  on l.game_id = a.game_id and l.player_id = a.player_id
where coalesce(l.seconds_played, 0) > 0 or a.player_id is not null;
