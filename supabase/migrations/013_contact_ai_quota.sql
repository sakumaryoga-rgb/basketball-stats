-- お問い合わせのAI利用枠(日次・月次)を、Anthropic APIへの呼び出し試行件数を基準に
-- アトミックに管理するためのテーブルとRPC関数。
-- SELECTで件数確認→後からINSERTという方式は同時リクエストで上限を超える可能性があるため、
-- 行ロック(for update)を用いたPL/pgSQL関数で「確認と枠確保」を1トランザクションにまとめる。

create table if not exists contact_ai_usage (
  period_type text not null,
  period_key text not null,
  count integer not null default 0,
  primary key (period_type, period_key)
);

alter table contact_ai_usage enable row level security;

-- 日次・月次のAI利用枠を1件消費できるか確認し、可能であればアトミックに消費してtrueを返す。
-- 呼び出し側は「Anthropic APIを呼び出す直前」にこの関数を呼び、trueが返った場合のみ呼び出す。
-- 成功・失敗・パース失敗にかかわらず、一度Anthropicへリクエストした時点で枠は消費済みのまま戻さない。
create or replace function contact_try_consume_ai_quota(
  p_daily_key text,
  p_daily_limit integer,
  p_monthly_key text,
  p_monthly_limit integer
) returns boolean
language plpgsql
as $$
declare
  daily_count integer;
  monthly_count integer;
begin
  insert into contact_ai_usage (period_type, period_key, count)
  values ('daily', p_daily_key, 0)
  on conflict (period_type, period_key) do nothing;

  insert into contact_ai_usage (period_type, period_key, count)
  values ('monthly', p_monthly_key, 0)
  on conflict (period_type, period_key) do nothing;

  -- ロック順序を daily → monthly に固定し、デッドロックを避ける
  select count into daily_count
    from contact_ai_usage
   where period_type = 'daily' and period_key = p_daily_key
   for update;

  select count into monthly_count
    from contact_ai_usage
   where period_type = 'monthly' and period_key = p_monthly_key
   for update;

  if daily_count >= p_daily_limit or monthly_count >= p_monthly_limit then
    return false;
  end if;

  update contact_ai_usage set count = count + 1
   where period_type = 'daily' and period_key = p_daily_key;

  update contact_ai_usage set count = count + 1
   where period_type = 'monthly' and period_key = p_monthly_key;

  return true;
end;
$$;

-- クライアントや匿名/authenticatedロールから直接呼べないようにし、service role(サーバー)専用にする
revoke all on function contact_try_consume_ai_quota(text, integer, text, integer) from public;
grant execute on function contact_try_consume_ai_quota(text, integer, text, integer) to service_role;
