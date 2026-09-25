-- 相手チームの得点記録を、Postgres側で原子的に処理するRPCへ移行する。
--
-- 【背景1】これまではクライアント側で
--   1) opponent_score_eventsへINSERT
--   2) games.opponent_score = (Reactの古いstateの値) + 得点 でUPDATE
-- という2段階の処理をしており、(2)がクライアント側の古いstate値を基準にしていたため、
-- 短時間に連続で記録すると加点が一部失われるロスト・アップデートが発生し得た。
--
-- 【背景2】Undo側にも別の競合があった: 「最新のイベントをSELECT→そのstat_keyの
-- 得点ぶんscoreを減算」という処理を、最新イベントの行ロック無しで行うと、ほぼ同時に
-- 2回Undoが呼ばれた場合に両方が同じ最新イベントをSELECTしてしまい、DELETEが
-- 実質1件しか効かなくても両方がscoreを減算してしまう(二重減算)可能性があった。
--
-- 【方針】既存のincrement_shooting_entry/regenerate_share_token等と同じ確立された
-- パターン(security definer関数内でis_team_memberを確認し、権限が無ければ例外を
-- 発生させたうえで書き込みを行う)を踏襲する。加えて、関数の冒頭でgames行を
-- `for update`によって明示的にロックし、同一game_idに対するrecord/undoの呼び出しを
-- DB側で完全に直列化する。これにより:
--   - 2回目以降の呼び出しは、1回目がコミットするまでブロックされ、
--     コミット後は必ず最新の状態(event一覧・opponent_score)を見てから処理する
--   - Undoの「最新イベントをSELECT」は常にロック取得後に行われるため、
--     二重に同じイベントを選んでしまうことが無くなる
-- DELETE件数もGET DIAGNOSTICSで確認し、想定外に0件だった場合はscoreを更新せず
-- 例外を発生させる(「eventだけ残る/scoreだけ変わる」という部分成功を防ぐ保険)。
--
-- 既存のapply_opponent_score_plus_minusトリガー(games.opponent_score のUPDATE時に
-- game_lineups.plus_minus を調整する)は、更新の発生元がRPC経由でもクライアント直接
-- 更新でも同一に発火するため、このRPCへの移行によるplus_minus計算への影響は無い。
--
-- 既存データへの変更は無い(関数の追加のみ)。

create or replace function record_opponent_score(p_game_id uuid, p_stat_key text, p_quarter int)
returns table(event_id uuid, new_opponent_score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_points int;
  v_event_id uuid;
  v_new_score int;
begin
  -- games行をロックし、同一game_idに対するrecord/undoの呼び出しをここで直列化する
  select team_id into v_team_id from games where id = p_game_id for update;
  if v_team_id is null or not is_team_member(v_team_id) then
    raise exception 'permission denied';
  end if;

  if p_stat_key not in ('fg2_make', 'fg3_make', 'ft_make') then
    raise exception 'invalid stat_key: %', p_stat_key;
  end if;

  v_points := stat_event_points(p_stat_key);

  insert into opponent_score_events (game_id, stat_key, quarter, created_by)
  values (p_game_id, p_stat_key, coalesce(p_quarter, 1), auth.uid())
  returning id into v_event_id;

  update games
  set opponent_score = coalesce(opponent_score, 0) + v_points
  where id = p_game_id
  returning opponent_score into v_new_score;

  return query select v_event_id, v_new_score;
end;
$$;

revoke all on function record_opponent_score(uuid, text, int) from public;
grant execute on function record_opponent_score(uuid, text, int) to authenticated;

create or replace function undo_last_opponent_score(p_game_id uuid)
returns table(event_id uuid, new_opponent_score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_event_id uuid;
  v_stat_key text;
  v_points int;
  v_new_score int;
  v_deleted_count int;
begin
  -- games行をロックし、同一game_idに対するrecord/undoの呼び出しをここで直列化する。
  -- これにより、この直後の「最新イベントをSELECT」が常に他の呼び出しの完了後の
  -- 状態を見ることになり、2回のUndoが同じイベントを選んでしまうことが無くなる。
  select team_id into v_team_id from games where id = p_game_id for update;
  if v_team_id is null or not is_team_member(v_team_id) then
    raise exception 'permission denied';
  end if;

  -- created_atが万一同値になった場合の決定的なtie-break(idはuuidで意味的な
  -- 時系列順ではないが、ORDER BYの結果を一意・決定的にするためだけに使う)。
  -- ロックにより同一gameへのINSERTは直列化されるため通常はcreated_atが必ず
  -- 単調増加し、このtie-breakは実質的には発火しない想定の保険。
  select id, stat_key into v_event_id, v_stat_key
  from opponent_score_events
  where game_id = p_game_id
  order by created_at desc, id desc
  limit 1;

  if v_event_id is null then
    raise exception 'no opponent score event to undo';
  end if;

  v_points := stat_event_points(v_stat_key);

  delete from opponent_score_events where id = v_event_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'failed to delete opponent score event %', v_event_id;
  end if;

  update games
  set opponent_score = greatest(0, coalesce(opponent_score, 0) - v_points)
  where id = p_game_id
  returning opponent_score into v_new_score;

  return query select v_event_id, v_new_score;
end;
$$;

revoke all on function undo_last_opponent_score(uuid) from public;
grant execute on function undo_last_opponent_score(uuid) to authenticated;
