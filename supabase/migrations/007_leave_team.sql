-- チーム退出機能。自分自身の team_members 行だけを削除できるようにする
-- (他のメンバーの行やチーム自体には影響しない)。
create policy "leave team" on team_members
  for delete using (user_id = auth.uid());
