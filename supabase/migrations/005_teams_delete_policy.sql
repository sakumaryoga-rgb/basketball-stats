-- チームの削除を許可する(既存メンバーなら誰でも削除可能。
-- team_members/players/games は team_id に on delete cascade が設定済みのため、
-- チームを削除すれば選手・試合・スタッツもまとめて削除される)
drop policy if exists "delete own team" on teams;
create policy "delete own team" on teams
  for delete using (is_team_member(id));
