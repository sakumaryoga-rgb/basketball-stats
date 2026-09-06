-- player_game_stats に出場時間(seconds_played)を追加。
-- PLAYERページの試合ごとの成績をBOX SCOREと同じ列構成で表示できるようにする。
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
  ), 0)::int as plus_minus,
  coalesce((
    select gl.seconds_played from game_lineups gl
    where gl.game_id = stat_events.game_id and gl.player_id = stat_events.player_id
  ), 0)::int as seconds_played
from stat_events
group by game_id, player_id;
