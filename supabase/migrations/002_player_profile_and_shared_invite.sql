-- 選手プロフィール(身長・体重・写真)の追加
alter table players add column if not exists height_cm numeric;
alter table players add column if not exists weight_kg numeric;
alter table players add column if not exists photo_url text;

-- 選手写真の保存先バケット
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

drop policy if exists "player photos public read" on storage.objects;
create policy "player photos public read" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "player photos write" on storage.objects;
create policy "player photos write" on storage.objects
  for insert to authenticated with check (bucket_id = 'player-photos');

drop policy if exists "player photos update" on storage.objects;
create policy "player photos update" on storage.objects
  for update to authenticated using (bucket_id = 'player-photos');

drop policy if exists "player photos delete" on storage.objects;
create policy "player photos delete" on storage.objects
  for delete to authenticated using (bucket_id = 'player-photos');

-- 招待リンクでの参加を常に成功させる。
-- 従来は既に(別の)チームに所属している端末が招待コードで参加しようとすると
-- 「すでにチームに所属しています」というエラーになり参加できなかった。
-- これが、招待リンクを送っても全員が同じチームのデータを見られない
-- (ブラウザ/端末ごとに別々のチームになってしまう)原因だった。
-- 既に別チームに所属していた場合は、参加先のチームに切り替える。
create or replace function join_team(join_code text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team teams;
  current_team_id uuid;
begin
  select * into target_team from teams where invite_code = upper(join_code);

  if not found then
    raise exception '招待コードが見つかりません';
  end if;

  select team_id into current_team_id from team_members where user_id = auth.uid();

  if current_team_id is null then
    insert into team_members (team_id, user_id) values (target_team.id, auth.uid());
  elsif current_team_id <> target_team.id then
    update team_members set team_id = target_team.id, joined_at = now() where user_id = auth.uid();
  end if;

  return target_team;
end;
$$;
