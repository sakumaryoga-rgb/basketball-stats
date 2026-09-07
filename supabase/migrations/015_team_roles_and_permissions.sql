-- チームの権限モデルを導入する。
--   role: 'admin'(チーム作成者、原則1人以上必須) / 'member'
--   device_category: 参加した端末が何かを自己申告する固定区分(自由入力の名前は使わない)
--   recording_granted_until: 管理者がmemberに一時的に付与する記録権限の期限
--
-- 記録権限(games/stat_eventsの書き込み)は admin または recording_granted_until が有効な
-- メンバーのみに限定する。閲覧(SELECT)は従来通り全メンバーに開放したまま。
--
-- team_members(=端末)を権限の単位とし、playersテーブル(選手ロスター)とは一切紐付けない。
-- コーチ・マネージャー・ベンチ端末・複数端末を持つ選手など、いずれのケースにも対応できる。

create extension if not exists pgcrypto;

alter table team_members add column if not exists role text not null default 'member' check (role in ('admin', 'member'));
alter table team_members add column if not exists device_category text check (device_category in ('player', 'coach', 'manager', 'bench', 'other'));
alter table team_members add column if not exists recording_granted_until timestamptz;

alter table teams add column if not exists admin_recovery_code_hash text;

-- 移行措置: これまでadminという概念がなかったため、各チームの最古参加者(≒作成者)をadminにする
with first_members as (
  select distinct on (team_id) id
  from team_members
  order by team_id, joined_at asc
)
update team_members set role = 'admin' where id in (select id from first_members);

-- 記録権限があるか(admin、または一時許可が有効期限内)を判定するヘルパー
create or replace function public.can_record(p_team_id uuid) returns boolean
language sql security definer set search_path to 'public' stable as $function$
  select exists (
    select 1 from team_members
     where team_id = p_team_id and user_id = auth.uid()
       and (role = 'admin' or recording_granted_until > now())
  );
$function$;

-- チーム作成者を自動的にadminにする
create or replace function public.create_team(team_name text) returns teams
language plpgsql security definer set search_path to 'public' as $function$
declare
  new_team teams;
  code text;
begin
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into teams (name, invite_code) values (team_name, code) returning * into new_team;
  insert into team_members (team_id, user_id, role) values (new_team.id, auth.uid(), 'admin');
  return new_team;
end;
$function$;

-- 参加した本人が、自分の端末の用途区分を自己申告する
create or replace function public.set_device_category(p_team_id uuid, p_category text) returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  if p_category not in ('player', 'coach', 'manager', 'bench', 'other') then
    raise exception '不正な区分です';
  end if;
  update team_members set device_category = p_category
   where team_id = p_team_id and user_id = auth.uid();
  if not found then
    raise exception 'チームメンバーが見つかりません';
  end if;
end;
$function$;

-- 管理者が特定のメンバー(端末)に一時的な記録権限を付与する
create or replace function public.grant_recording_permission(p_team_id uuid, p_member_id uuid, p_hours integer) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  is_admin boolean;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;
  if p_hours <= 0 or p_hours > 24 * 30 then
    raise exception '許可時間が不正です';
  end if;
  update team_members set recording_granted_until = now() + (p_hours || ' hours')::interval
   where team_id = p_team_id and id = p_member_id;
end;
$function$;

-- 管理者が一時的な記録権限を取り消す
create or replace function public.revoke_recording_permission(p_team_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  is_admin boolean;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;
  update team_members set recording_granted_until = null
   where team_id = p_team_id and id = p_member_id;
end;
$function$;

-- 管理者を他のメンバーへ交代する(自分はmemberに戻り、チームには残る)
create or replace function public.transfer_admin(p_team_id uuid, p_new_admin_member_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  is_admin boolean;
  target_team_id uuid;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;

  select team_id into target_team_id from team_members where id = p_new_admin_member_id and team_id = p_team_id;
  if target_team_id is null then
    raise exception '移譲先のメンバーが見つかりません';
  end if;

  update team_members set role = 'admin' where id = p_new_admin_member_id;
  update team_members set role = 'member' where team_id = p_team_id and user_id = auth.uid();
end;
$function$;

-- 管理者を他のメンバーへ移譲したうえで、自分はチームから退出する(アトミック)
create or replace function public.transfer_admin_and_leave(p_team_id uuid, p_new_admin_member_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  is_admin boolean;
  target_team_id uuid;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;

  select team_id into target_team_id from team_members where id = p_new_admin_member_id and team_id = p_team_id;
  if target_team_id is null then
    raise exception '移譲先のメンバーが見つかりません';
  end if;

  update team_members set role = 'admin' where id = p_new_admin_member_id;
  delete from team_members where team_id = p_team_id and user_id = auth.uid();
end;
$function$;

-- 管理者復旧コードの試行回数を記録するテーブル(総当たり対策)。クライアントからの直接アクセスは不可。
create table if not exists recovery_code_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);
alter table recovery_code_attempts enable row level security;
create index if not exists recovery_code_attempts_team_id_idx on recovery_code_attempts (team_id, attempted_at);

-- 管理者復旧コードを(再)発行する。平文が読めるのはこの戻り値の一度きり(以降はハッシュのみ保存)
create or replace function public.generate_admin_recovery_code(p_team_id uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  is_admin boolean;
  plain_code text;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;

  plain_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12))
             || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
  update teams set admin_recovery_code_hash = encode(digest(plain_code, 'sha256'), 'hex')
   where id = p_team_id;
  return plain_code;
end;
$function$;

-- 復旧コードを使って、今の端末をそのチームの管理者として登録する
-- raise exceptionで失敗させると、その直前に行った試行ログのINSERTごと呼び出し全体が
-- ロールバックされてしまいレート制限が機能しなくなるため、想定される失敗パス
-- (コード誤り・試行回数超過)では例外を投げず、成功/失敗をレコードとして返す設計にする。
create or replace function public.redeem_admin_recovery_code(p_invite_code text, p_recovery_code text)
returns table(success boolean, message text, out_team_id uuid, out_team_name text)
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  target_team teams;
  recent_attempts integer;
begin
  select * into target_team from teams where invite_code = upper(p_invite_code);
  if not found then
    return query select false, 'チームが見つかりません'::text, null::uuid, null::text;
    return;
  end if;

  select count(*) into recent_attempts
    from recovery_code_attempts rca
   where rca.team_id = target_team.id and rca.attempted_at > now() - interval '1 hour';

  -- 先に試行を記録する(この後は例外を発生させないため、必ずコミットされる)
  insert into recovery_code_attempts (team_id, user_id) values (target_team.id, auth.uid());

  if recent_attempts >= 5 then
    return query select false, '試行回数が上限に達しました。しばらく時間を置いてから再度お試しください'::text, null::uuid, null::text;
    return;
  end if;

  if target_team.admin_recovery_code_hash is null
     or target_team.admin_recovery_code_hash <> encode(digest(p_recovery_code, 'sha256'), 'hex') then
    return query select false, '復旧コードが正しくありません'::text, null::uuid, null::text;
    return;
  end if;

  insert into team_members (team_id, user_id, role)
  values (target_team.id, auth.uid(), 'admin')
  on conflict (team_id, user_id) do update set role = 'admin';

  return query select true, null::text, target_team.id, target_team.name;
end;
$function$;

-- RLS更新: games/stat_eventsの書き込みはcan_record()を満たす場合のみ。閲覧は従来通り全メンバー。
drop policy if exists "manage own team games" on games;
create policy "select own team games" on games for select using (is_team_member(team_id));
create policy "insert own team games" on games for insert with check (can_record(team_id));
create policy "update own team games" on games for update using (can_record(team_id)) with check (can_record(team_id));
create policy "delete own team games" on games for delete using (can_record(team_id));

drop policy if exists "manage own team stat_events" on stat_events;
create policy "select own team stat_events" on stat_events for select using (
  exists (select 1 from games g where g.id = stat_events.game_id and is_team_member(g.team_id))
);
create policy "insert own team stat_events" on stat_events for insert with check (
  exists (select 1 from games g where g.id = stat_events.game_id and can_record(g.team_id))
);
create policy "update own team stat_events" on stat_events for update using (
  exists (select 1 from games g where g.id = stat_events.game_id and can_record(g.team_id))
) with check (
  exists (select 1 from games g where g.id = stat_events.game_id and can_record(g.team_id))
);
create policy "delete own team stat_events" on stat_events for delete using (
  exists (select 1 from games g where g.id = stat_events.game_id and can_record(g.team_id))
);

-- team_membersの退出: 管理者自身の行は直接削除できない(transfer_admin_and_leaveのみ経由可能)
drop policy if exists "leave team" on team_members;
create policy "leave team" on team_members for delete using (user_id = auth.uid() and role <> 'admin');

-- teamsの削除は管理者のみ許可する(これまでは全メンバーが削除可能だった点を是正)
drop policy if exists "delete own team" on teams;
create policy "delete own team" on teams for delete using (
  exists (select 1 from team_members where team_id = teams.id and user_id = auth.uid() and role = 'admin')
);
