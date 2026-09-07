-- 自己アカウント削除機能のためのDBサポート。
--
-- user_consents(同意記録)は法的・運用上の証跡として保持する必要があるため、行ごと削除はしない。
-- 一方でuser_idは本人を特定できる識別情報なので、アカウント削除時にはNULLにして非識別化し、
-- 「いつ・どのバージョンに同意したか」という記録のみを匿名の履歴として残す。
-- そのためにはuser_id列のNOT NULL制約を緩和する必要がある。
alter table user_consents alter column user_id drop not null;
