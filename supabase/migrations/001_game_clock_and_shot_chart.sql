-- 「試合」画面をバスケスタッツアプリのフォーマットに近づけるため
-- クォーター・タイムアウト残・チームファウル・ショットチャート座標を追加する

alter table games add column if not exists quarter int not null default 1;
alter table games add column if not exists home_timeouts_remaining int not null default 5;
alter table games add column if not exists away_timeouts_remaining int not null default 5;
alter table games add column if not exists home_fouls int not null default 0;
alter table games add column if not exists away_fouls int not null default 0;

alter table stat_events add column if not exists quarter int not null default 1;
alter table stat_events add column if not exists shot_x numeric;
alter table stat_events add column if not exists shot_y numeric;
