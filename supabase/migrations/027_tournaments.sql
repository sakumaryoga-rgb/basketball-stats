-- 大会(tournament)テーブルを追加する。公式試合(games.game_type='official')は
-- 大会の子要素として扱い、GAMEタブは大会単位の一覧になる。大会の中で複数の
-- 試合を追加できるようにすることで、過去の記録を大会単位で参照しやすくする。
-- スクリメージ/シューティング(practice/shooting)は対象外で従来通り。

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table tournaments enable row level security;

drop policy if exists "manage own team tournaments" on tournaments;
create policy "manage own team tournaments" on tournaments for all
  using (is_team_member(team_id)) with check (is_team_member(team_id));

alter table games add column if not exists tournament_id uuid references tournaments(id) on delete cascade;

-- 既存の公式試合(この移行より前に作られたもの)を大会未紐付けのままにしないよう、
-- チームごとに「未整理の試合」という大会を自動作成してまとめて紐付ける
insert into tournaments (team_id, name)
select distinct team_id, '未整理の試合'
from games
where game_type = 'official' and tournament_id is null;

update games g
set tournament_id = t.id
from tournaments t
where g.game_type = 'official'
  and g.tournament_id is null
  and t.team_id = g.team_id
  and t.name = '未整理の試合';

-- 以後、公式試合は必ずどこかの大会に属することを強制する
alter table games drop constraint if exists games_official_requires_tournament;
alter table games add constraint games_official_requires_tournament
  check (game_type <> 'official' or tournament_id is not null);
