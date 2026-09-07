-- Passkey必須化・メール紐付け必須化・admin/member権限モデルの検討を中止し、
-- Walicaのような「チームごとの共有URLを知っている人がそのままチームを使える」
-- 最小構成に作り直す。role/device_category/recording_granted_until/管理者復旧コードの
-- 仕組みは全て撤去し、team_membersは「この匿名ユーザーが共有URLでこのチームに入ったことがある」
-- という事実だけを表す単純なJOINテーブルに戻す。RLSは全テーブルでis_team_member(team_id)に一本化する。

-- 1. games/stat_events/team_members/teamsのRLSポリシーを、role列に依存しない形に先に貼り替える
--    (この後で列・関数を削除するため、依存関係を先に断ち切っておく必要がある)

drop policy if exists "select own team games" on games;
drop policy if exists "insert own team games" on games;
drop policy if exists "update own team games" on games;
drop policy if exists "delete own team games" on games;
create policy "manage own team games" on games for all
  using (is_team_member(team_id)) with check (is_team_member(team_id));

drop policy if exists "select own team stat_events" on stat_events;
drop policy if exists "insert own team stat_events" on stat_events;
drop policy if exists "update own team stat_events" on stat_events;
drop policy if exists "delete own team stat_events" on stat_events;
create policy "manage own team stat_events" on stat_events for all using (
  exists (select 1 from games g where g.id = stat_events.game_id and is_team_member(g.team_id))
) with check (
  exists (select 1 from games g where g.id = stat_events.game_id and is_team_member(g.team_id))
);

drop policy if exists "leave team" on team_members;
create policy "leave team" on team_members for delete using (user_id = auth.uid());

drop policy if exists "delete own team" on teams;
create policy "delete own team" on teams for delete using (is_team_member(id));

-- 2. 権限モデル関連の関数を削除

drop function if exists public.can_record(uuid);
drop function if exists public.set_device_category(uuid, text);
drop function if exists public.grant_recording_permission(uuid, uuid, integer);
drop function if exists public.revoke_recording_permission(uuid, uuid);
drop function if exists public.transfer_admin(uuid, uuid);
drop function if exists public.transfer_admin_and_leave(uuid, uuid);
drop function if exists public.generate_admin_recovery_code(uuid);
drop function if exists public.redeem_admin_recovery_code(text, text);
drop function if exists public.remove_team_member(uuid, uuid);
drop function if exists public.join_team(text);

-- 3. 管理者復旧コードのレート制限テーブルを削除

drop table if exists recovery_code_attempts;

-- 4. team_membersを簡素化(役割・端末区分・一時権限の列を削除)

alter table team_members drop column if exists role;
alter table team_members drop column if exists device_category;
alter table team_members drop column if exists recording_granted_until;

-- 5. teamsに共有URLトークン用の列を追加し、旧来の招待コード・管理者復旧コード用の列を削除

alter table teams add column if not exists share_token_hash text;
alter table teams add column if not exists share_token_created_at timestamptz;
alter table teams drop column if exists invite_code;
alter table teams drop column if exists admin_recovery_code_hash;

create unique index if not exists teams_share_token_hash_key on teams (share_token_hash);

-- 6. チーム作成: 256bitの暗号乱数トークンを発行し、ハッシュのみDBに保存する。
--    平文トークンはこの戻り値でのみ一度返し、以後DBには残らない。

drop function if exists public.create_team(text);
create or replace function public.create_team(team_name text)
returns table(id uuid, name text, icon_url text, share_token text)
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  new_team teams;
  plain_token text;
begin
  plain_token := rtrim(replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=');

  insert into teams (name, share_token_hash, share_token_created_at)
  values (team_name, encode(extensions.digest(plain_token, 'sha256'), 'hex'), now())
  returning * into new_team;

  insert into team_members (team_id, user_id) values (new_team.id, auth.uid());

  return query select new_team.id, new_team.name, new_team.icon_url, plain_token;
end;
$function$;

-- 7. 共有URLのトークンからチームに参加する。想定される失敗(無効なトークン)は例外ではなく
--    レコードとして返す(既存のredeem_admin_recovery_codeで確立したパターンを踏襲)。

create or replace function public.redeem_share_token(p_token text)
returns table(success boolean, message text, out_team_id uuid, out_team_name text)
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  target_team teams;
begin
  select * into target_team from teams
   where share_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    return query select false, 'このリンクは無効です'::text, null::uuid, null::text;
    return;
  end if;

  insert into team_members (team_id, user_id) values (target_team.id, auth.uid())
  on conflict (team_id, user_id) do nothing;

  return query select true, null::text, target_team.id, target_team.name;
end;
$function$;

-- 8. 共有URLの再発行。呼び出し時点でチームメンバーであることのみ要求する(admin概念なし)。
--    上書きされた瞬間に旧トークンは即時失効するが、既にteam_membersに入っている端末の行は
--    削除しない(再発行は「新規参加の受付停止」のみが目的)。

create or replace function public.regenerate_share_token(p_team_id uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  plain_token text;
begin
  if not is_team_member(p_team_id) then
    raise exception 'このチームのメンバーのみ実行できます';
  end if;

  plain_token := rtrim(replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=');

  update teams set share_token_hash = encode(extensions.digest(plain_token, 'sha256'), 'hex'),
    share_token_created_at = now()
   where id = p_team_id;

  return plain_token;
end;
$function$;
