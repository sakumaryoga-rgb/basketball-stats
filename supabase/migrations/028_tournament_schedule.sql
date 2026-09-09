-- 大会に日程・会場を持たせ、大会作成時に入力した日程・会場を配下の試合に
-- 引き継ぐことで、試合を追加するたびに同じ日程・会場を入力する手間を省く。
-- あわせて、tournamentsテーブルがsupabase_realtimeのpublicationに含まれておらず、
-- 大会を作成してもリアルタイムでは一覧に反映されず手動更新するまで表示されない
-- 不具合があったため、他の主要テーブル同様にpublicationへ追加する。

alter table tournaments add column if not exists game_date date not null default current_date;
alter table tournaments add column if not exists location text;

alter publication supabase_realtime add table tournaments;
