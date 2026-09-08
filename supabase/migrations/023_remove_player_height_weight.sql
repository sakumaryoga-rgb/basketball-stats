-- プライバシーの観点から、選手の身長・体重の記録項目を廃止する。
alter table players drop column if exists height_cm;
alter table players drop column if exists weight_kg;
