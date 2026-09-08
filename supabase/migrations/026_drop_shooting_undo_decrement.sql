-- 025で追加した取り消し機能用のdecrement_shooting_entryを撤去する。
-- 取り消し機能自体をアプリ側から削除し、記録の訂正は既存の
-- ゾーン単位の削除(resetZone/削除アイコン)に一本化したため不要になった。
drop function if exists decrement_shooting_entry(uuid, uuid, text, int, int);
