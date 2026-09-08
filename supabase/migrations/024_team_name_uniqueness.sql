-- チーム作成時に、既に使用されているチーム名(前後の空白を除き、大文字小文字を区別しない)を
-- 選べないようにする。既存データに同名重複が残っている場合があるため、DBレベルのunique制約は
-- 追加せず、create_team RPC側での事前チェックのみで新規作成時の重複を防ぐ。
create or replace function public.create_team(team_name text)
returns table(id uuid, name text, icon_url text, share_token text)
language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare
  new_team teams;
  plain_token text;
  normalized_name text := trim(team_name);
begin
  if normalized_name = '' then
    raise exception 'チーム名を入力してください';
  end if;

  if exists (select 1 from teams t where lower(trim(t.name)) = lower(normalized_name)) then
    raise exception 'そのチーム名は既に使用されています';
  end if;

  plain_token := rtrim(replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=');

  insert into teams (name, share_token_hash, share_token_created_at)
  values (normalized_name, encode(extensions.digest(plain_token, 'sha256'), 'hex'), now())
  returning * into new_team;

  insert into team_members (team_id, user_id) values (new_team.id, auth.uid());

  return query select new_team.id, new_team.name, new_team.icon_url, plain_token;
end;
$function$;
