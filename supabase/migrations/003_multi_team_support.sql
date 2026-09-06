-- 複数チーム対応: 1つの端末(匿名ユーザー)が複数のチームに同時に所属できるようにする。
-- 従来は team_members.user_id が UNIQUE で「1人1チーム」前提だったため、
-- 招待リンクで参加すると元のチームから強制的に切り替わってしまっていた。

alter table team_members drop constraint if exists team_members_user_id_key;
alter table team_members add constraint team_members_team_id_user_id_key unique (team_id, user_id);

-- 「自分がそのチームのメンバーか」を判定するヘルパー関数。
-- 旧 my_team_id() は1人1チーム前提の実装で、複数チーム所属時には
-- 「サブクエリが複数行返す」エラーになってしまうため置き換える。
create or replace function is_team_member(check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members where team_id = check_team_id and user_id = auth.uid()
  );
$$;

drop policy if exists "select own team" on teams;
create policy "select own team" on teams
  for select using (is_team_member(id));

drop policy if exists "select own team members" on team_members;
create policy "select own team members" on team_members
  for select using (is_team_member(team_id));

drop policy if exists "manage own team players" on players;
create policy "manage own team players" on players
  for all
  using (is_team_member(team_id))
  with check (is_team_member(team_id));

drop policy if exists "manage own team games" on games;
create policy "manage own team games" on games
  for all
  using (is_team_member(team_id))
  with check (is_team_member(team_id));

drop policy if exists "manage own team stat_events" on stat_events;
create policy "manage own team stat_events" on stat_events
  for all
  using (
    exists (select 1 from games g where g.id = stat_events.game_id and is_team_member(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = stat_events.game_id and is_team_member(g.team_id))
  );

drop function if exists my_team_id();

-- チーム作成: 複数チームの作成・所属を許可(既存チーム所属チェックを撤廃)
create or replace function create_team(team_name text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team teams;
  code text;
begin
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into teams (name, invite_code) values (team_name, code)
  returning * into new_team;

  insert into team_members (team_id, user_id) values (new_team.id, auth.uid());

  return new_team;
end;
$$;

-- 招待コードでの参加: 複数チーム所属を許可するため、既存チームからの
-- 切り替えではなく単純にそのチームへの参加を追加する(参加済みなら何もしない)
create or replace function join_team(join_code text)
returns teams
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team teams;
begin
  select * into target_team from teams where invite_code = upper(join_code);

  if not found then
    raise exception '招待コードが見つかりません';
  end if;

  insert into team_members (team_id, user_id)
  values (target_team.id, auth.uid())
  on conflict (team_id, user_id) do nothing;

  return target_team;
end;
$$;

-- チームプロフィール用のアイコン画像
alter table teams add column if not exists icon_url text;

insert into storage.buckets (id, name, public)
values ('team-icons', 'team-icons', true)
on conflict (id) do nothing;

drop policy if exists "team icons public read" on storage.objects;
create policy "team icons public read" on storage.objects
  for select using (bucket_id = 'team-icons');

drop policy if exists "team icons write" on storage.objects;
create policy "team icons write" on storage.objects
  for insert to authenticated with check (bucket_id = 'team-icons');

drop policy if exists "team icons update" on storage.objects;
create policy "team icons update" on storage.objects
  for update to authenticated using (bucket_id = 'team-icons');

drop policy if exists "team icons delete" on storage.objects;
create policy "team icons delete" on storage.objects
  for delete to authenticated using (bucket_id = 'team-icons');
