-- 相手チームの得点をイベント単位(ショット種別・クォーター・発生時刻)で記録するテーブル。
-- 相手チームの選手名簿はBASKETBALL STATSで管理していないため、プレイヤー単位の
-- 紐付けは行わない(誰が決めたかではなく、いつ・何点入ったかのみを記録する)。
-- games.opponent_scoreは引き続き「現在の合計得点」として使う(既存の
-- apply_opponent_score_plus_minusトリガーやスコア表示ロジックに影響を与えないため)。
-- このテーブルは、スコアシートのRunning Score欄を相手チームぶんも再現するための
-- 追加ログという位置づけ。

create table if not exists opponent_score_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  stat_key text not null check (stat_key in ('fg2_make', 'fg3_make', 'ft_make')),
  quarter int not null default 1 check (quarter >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists idx_opponent_score_events_game on opponent_score_events(game_id);

alter table opponent_score_events enable row level security;

create policy "manage own team opponent_score_events" on opponent_score_events
  for all
  using (
    exists (select 1 from games g where g.id = opponent_score_events.game_id and is_team_member(g.team_id))
  )
  with check (
    exists (select 1 from games g where g.id = opponent_score_events.game_id and is_team_member(g.team_id))
  );

alter publication supabase_realtime add table opponent_score_events;
