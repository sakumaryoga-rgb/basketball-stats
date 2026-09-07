-- お問い合わせ機能のレート制限・AI分類上限管理用テーブル
-- サーバー(Vercel Function, service role)からのみ読み書きする。RLSはポリシー無し=全面拒否とし、
-- service role keyのみがRLSをバイパスしてアクセスできる。

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  ip_hash text not null,
  message_hash text not null,
  ai_classified boolean not null default false,
  notion_page_id text
);

alter table contact_submissions enable row level security;

create index if not exists contact_submissions_user_created_idx
  on contact_submissions (user_id, created_at);

create index if not exists contact_submissions_ip_created_idx
  on contact_submissions (ip_hash, created_at);

create index if not exists contact_submissions_dedup_idx
  on contact_submissions (user_id, message_hash, created_at);

create index if not exists contact_submissions_ai_classified_idx
  on contact_submissions (created_at) where ai_classified = true;
