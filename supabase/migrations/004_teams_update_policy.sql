-- teams テーブルに UPDATE 用の RLS ポリシーが存在せず、チーム名やアイコンの
-- 更新が(エラーにもならず)常に0行更新で失敗していたための修正。
drop policy if exists "update own team" on teams;
create policy "update own team" on teams
  for update using (is_team_member(id)) with check (is_team_member(id));
