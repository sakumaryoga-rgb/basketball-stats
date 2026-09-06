-- ゲスト選手対応。
-- 助っ人としてその試合だけ参加する選手を、通常のロスターやシーズン成績・
-- リーダーボードに影響を与えずに記録できるようにする。
-- guest_game_id が設定されている players 行は「その試合限定のゲスト」であり、
-- 通常のロスター(guest_game_id is null)とは区別して扱う。
-- 対象の試合が削除されればゲスト選手も一緒に消えるよう on delete cascade にする。

alter table players add column if not exists guest_game_id uuid references games(id) on delete cascade;
create index if not exists idx_players_guest_game_id on players(guest_game_id);

-- シーズン成績はゲストを含めない(guest_game_id is null の選手のみ集計する)
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
where p.guest_game_id is null
group by p.id, p.team_id;
