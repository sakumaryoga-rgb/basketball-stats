-- 選手の第二ポジション(任意)。第一ポジション(position)は既存のまま利用する。
alter table players add column if not exists position2 text;
