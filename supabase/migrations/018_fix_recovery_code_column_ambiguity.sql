-- RETURNS TABLEの出力列名(team_id, team_name)が、関数本文内のクエリで参照している
-- recovery_code_attempts.team_id等の列名と衝突し、"column reference is ambiguous"エラーに
-- なっていたバグを修正する。出力列名をout_接頭辞付きに変更して衝突を避ける。

drop function if exists public.redeem_admin_recovery_code(text, text);

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
