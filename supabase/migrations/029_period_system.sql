-- 大会(ひいてはその配下の公式試合)を2Q制/4Q制のどちらで記録するか選べるようにする。
-- 2Q制の試合は記録画面のクォーター選択が「前半」「後半」「1OT」になり、PLAYER/TEAMタブの
-- 「1試合平均」も2Q制/4Q制で別々に集計できるようにするための土台。
-- games側にも複製して持たせるのは、games.game_date/locationをtournamentsからコピーしている
-- 既存の実装パターン(028)に合わせ、平均集計のたびにtournamentsまでJOINしなくて済むようにするため。
-- スクリメージ/シューティング(game_type <> 'official')はこの値を使わない(常に従来の4Q表示)。

alter table tournaments add column if not exists period_system text not null default '4q'
  check (period_system in ('2q', '4q'));

alter table games add column if not exists period_system text not null default '4q'
  check (period_system in ('2q', '4q'));

-- 既存の大会・公式試合は、これまで前半→Q1・後半→Q2として記録してきた実態に合わせ、
-- すべて2Q制として分類する。
update tournaments set period_system = '2q';
update games set period_system = '2q' where game_type = 'official';
