-- シューティング記録の「取り消し」機能用。increment_shooting_entryが加算専用のため、
-- 直前に加算した分だけを正確に打ち消す(元の数値を割り込まない)減算専用の対になる関数を追加する。
create or replace function decrement_shooting_entry(p_game_id uuid, p_player_id uuid, p_zone text, p_attempts int, p_makes int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from games g where g.id = p_game_id and is_team_member(g.team_id)) then
    raise exception 'permission denied';
  end if;

  update shooting_entries
  set
    attempts = greatest(0, attempts - p_attempts),
    makes = greatest(0, makes - p_makes),
    updated_at = now()
  where game_id = p_game_id and player_id = p_player_id and zone = p_zone;
end;
$$;

grant execute on function decrement_shooting_entry(uuid, uuid, text, int, int) to authenticated;
