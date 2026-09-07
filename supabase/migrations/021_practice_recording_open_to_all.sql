-- PRACTICE(games.game_type = 'practice'のスクリメージ、'shooting'のシューティングセッション)の
-- 記録内容はチームの公式スタッツ(player_game_stats等)には反映されないため、admin/記録権限の
-- 有無にかかわらず全メンバーが更新できるようにする。official(通常の試合)は引き続きcan_record()で
-- 制限する。shooting_entriesは元からis_team_member()のみで運用されており対象外(変更なし)。

drop policy if exists "insert own team games" on games;
create policy "insert own team games" on games for insert with check (
  case when game_type = 'official' then can_record(team_id) else is_team_member(team_id) end
);

drop policy if exists "update own team games" on games;
create policy "update own team games" on games for update using (
  case when game_type = 'official' then can_record(team_id) else is_team_member(team_id) end
) with check (
  case when game_type = 'official' then can_record(team_id) else is_team_member(team_id) end
);

drop policy if exists "delete own team games" on games;
create policy "delete own team games" on games for delete using (
  case when game_type = 'official' then can_record(team_id) else is_team_member(team_id) end
);

drop policy if exists "insert own team stat_events" on stat_events;
create policy "insert own team stat_events" on stat_events for insert with check (
  exists (
    select 1 from games g where g.id = stat_events.game_id
      and (case when g.game_type = 'official' then can_record(g.team_id) else is_team_member(g.team_id) end)
  )
);

drop policy if exists "update own team stat_events" on stat_events;
create policy "update own team stat_events" on stat_events for update using (
  exists (
    select 1 from games g where g.id = stat_events.game_id
      and (case when g.game_type = 'official' then can_record(g.team_id) else is_team_member(g.team_id) end)
  )
) with check (
  exists (
    select 1 from games g where g.id = stat_events.game_id
      and (case when g.game_type = 'official' then can_record(g.team_id) else is_team_member(g.team_id) end)
  )
);

drop policy if exists "delete own team stat_events" on stat_events;
create policy "delete own team stat_events" on stat_events for delete using (
  exists (
    select 1 from games g where g.id = stat_events.game_id
      and (case when g.game_type = 'official' then can_record(g.team_id) else is_team_member(g.team_id) end)
  )
);
