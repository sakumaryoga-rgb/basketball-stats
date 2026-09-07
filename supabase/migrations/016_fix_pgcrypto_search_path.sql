-- Supabaseではpgcryptoがpublicではなくextensionsスキーマにインストールされるため、
-- digest()を使う関数のsearch_pathにextensionsを追加する。

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

create or replace function public.redeem_admin_recovery_code(p_invite_code text, p_recovery_code text) returns teams
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  target_team teams;
  recent_attempts integer;
begin
  select * into target_team from teams where invite_code = upper(p_invite_code);
  if not found then
    raise exception 'チームが見つかりません';
  end if;

  select count(*) into recent_attempts
    from recovery_code_attempts
   where team_id = target_team.id and attempted_at > now() - interval '1 hour';
  if recent_attempts >= 5 then
    raise exception '試行回数が上限に達しました。しばらく時間を置いてから再度お試しください';
  end if;

  insert into recovery_code_attempts (team_id, user_id) values (target_team.id, auth.uid());

  if target_team.admin_recovery_code_hash is null
     or target_team.admin_recovery_code_hash <> encode(digest(p_recovery_code, 'sha256'), 'hex') then
    raise exception '復旧コードが正しくありません';
  end if;

  insert into team_members (team_id, user_id, role)
  values (target_team.id, auth.uid(), 'admin')
  on conflict (team_id, user_id) do update set role = 'admin';

  return target_team;
end;
$function$;
