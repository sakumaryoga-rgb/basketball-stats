-- 管理者が、不要になったメンバー(端末)のアクセス権を取り消す機能。
-- あくまでteam_membersの行(=その端末のチームへのアクセス権)を削除するだけであり、
-- 個人情報の削除(法的な削除依頼)とは別物。個人情報削除の依頼は運営者の窓口(お問い合わせ)へ
-- 案内する方針のため、この関数はアクセス取り消し以上のことは一切行わない。
create or replace function public.remove_team_member(p_team_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare
  is_admin boolean;
  target_role text;
  target_user_id uuid;
begin
  select exists(
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  ) into is_admin;
  if not is_admin then
    raise exception '管理者のみ実行できます';
  end if;

  select role, user_id into target_role, target_user_id
    from team_members where id = p_member_id and team_id = p_team_id;
  if target_role is null then
    raise exception '対象のメンバーが見つかりません';
  end if;
  if target_role = 'admin' then
    raise exception '管理者は削除できません(先に管理者移譲してください)';
  end if;
  if target_user_id = auth.uid() then
    raise exception '自分自身の退出は「チームを退出する」から行ってください';
  end if;

  delete from team_members where id = p_member_id and team_id = p_team_id;
end;
$function$;
