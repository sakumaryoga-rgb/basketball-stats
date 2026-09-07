-- 利用規約・プライバシーポリシーへの同意記録。
-- 端末のlocalStorageが消えても後から確認できる、消えない・追記専用(更新・削除なし)の同意ログ。
-- 将来規約を改定した場合、TERMS_VERSION/PRIVACY_VERSIONを更新し新たな行として追記することで、
-- どのバージョンにいつ同意したかの履歴を保持する。

create table if not exists user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  agreed_at timestamptz not null default now()
);

alter table user_consents enable row level security;

create index if not exists user_consents_user_id_idx on user_consents (user_id);

-- 匿名認証ユーザーも含め、本人の同意記録のみ挿入・閲覧できる(更新・削除は不可の追記専用ログ)
create policy "insert_own_consent" on user_consents
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "select_own_consent" on user_consents
  for select
  to authenticated
  using (auth.uid() = user_id);
