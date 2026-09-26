// ScoreSheetViewModelの型定義。
//
// このプロジェクトはJS+JSXのみで構成されており(tsconfig/.tsファイルは存在しない)、
// TypeScriptの型チェックパイプラインは導入されていない。実際に.tsファイルを追加すると
// 「新しいツールチェーンの導入」に相当してしまうため、TypeScriptのinterfaceと同等の
// 構造をJSDoc @typedefとして記述する(エディタの型補完・ホバー表示はTSと同様に機能し、
// ビルド構成には一切影響しない)。将来的にプロジェクト全体をTS化する場合は、この
// ファイルの型定義をほぼそのまま.tsのinterfaceへ移植できる。
//
// buildScoreSheetViewModel.js(Supabase→ViewModelのmapper)はこの形に正規化した
// オブジェクトを返す。ScoreSheet.jsx(表示)はSupabaseの行を直接参照せず、必ず
// このViewModelだけを見る。将来JBA/FIBA帳票形式・CSV等の出力を増やす場合も、
// この同じViewModelを入力にできる。

/**
 * @typedef {Object} ScoreSheetGameInfo
 * @property {string} id
 * @property {string|null} competition - 大会名(tournaments.name)。スクリメージ等、大会に属さない試合はnull
 * @property {string|null} gameNumber - 大会内の試合番号。現状DBに保持されていないため常にnull(NOT_RECORDED)
 * @property {string} date - 'YYYY-MM-DD'(games.game_date)
 * @property {string|null} startTime - 試合開始時刻。現状DBに保持されていないため常にnull(NOT_RECORDED)
 * @property {string|null} endTime - 試合終了時刻。現状DBに保持されていないため常にnull(NOT_RECORDED。
 *   JBA公式スコアシートでは試合後に1分刻みで記入する項目)
 * @property {string|null} place - 会場(games.location)
 * @property {'official'|'practice'|'shooting'} gameType
 * @property {'2q'|'4q'} periodSystem
 * @property {number} lastPeriod - 到達した最終クォーター(games.quarter)。表示すべきQ列の上限に使う
 * @property {'scheduled'|'in_progress'|'final'} status
 */

/**
 * @typedef {Object} ScoreSheetPlayer
 * @property {string} id
 * @property {number|null} number - 背番号
 * @property {string} name
 * @property {boolean} isGuest
 * @property {boolean} startedOnCourt - 出場記録(game_lineups.on_court)に基づく参考値。
 *   途中交代の履歴(いつ・誰と交代したか)はDBに保存されていないため、試合開始時点の
 *   STARTING FIVEそのものではなく、現時点(=試合終了時点)の出場状況を代替値として使っている。
 *   途中交代が無かった試合では実際のスターターと一致するが、保証はできない。
 * @property {boolean} isCaptain - 常にfalse(NOT_RECORDED。キャプテンの概念がDBに無い)
 * @property {number} secondsPlayed
 * @property {ScoreSheetPlayerStatLine} stats
 * @property {number[]} foulSequence - DERIVABLE: この選手の個人ファウルが発生した順に、
 *   そのクォーター番号を並べた配列(例: [1,1,3]なら1Qに2回・3Qに1回)。JBA公式の
 *   「ファウルボックスに1本ごとの種別コード(P/T/U/D)を書く」記入方式を参考にしたが、
 *   stat_eventsにファウル種別の区別が無いため、種別コードの代わりにクォーター番号を表示する
 */

/**
 * @typedef {Object} ScoreSheetPlayerStatLine - NBA.com Traditional Box Score相当。DERIVABLE(player_game_stats/player_practice_game_statsビューより)
 * @property {number} pts
 * @property {number} fgm
 * @property {number} fga
 * @property {number} tpm - 3P成功
 * @property {number} tpa - 3P試投
 * @property {number} twoPm - 2P成功(fgm-tpmの算術導出)
 * @property {number} twoPa - 2P試投(fga-tpaの算術導出)
 * @property {number} ftm
 * @property {number} fta
 * @property {number} oreb
 * @property {number} dreb
 * @property {number} reb
 * @property {number} ast
 * @property {number} stl
 * @property {number} blk
 * @property {number} tov
 * @property {number} pf
 * @property {number} plusMinus
 */

/**
 * @typedef {Object} ScoreSheetQuarterFoul - 選手の1クォーターあたりの個人ファウル数。
 *   stat_events(stat_key='pf', quarter)から集計したDERIVABLE値。ファウルの種別
 *   (パーソナル/テクニカル/アンスポーツマンライク等)はDBに区別が無いため常に「PF」のみ。
 * @property {number} period
 * @property {number} count
 */

/**
 * @typedef {Object} ScoreSheetTeamSide
 * @property {string|null} teamId - 自チームはteams.id。相手チームは選手管理が無いためnull
 * @property {string} name
 * @property {boolean} isSelf - 自チーム(home)かどうか
 * @property {ScoreSheetPlayer[]} players - この試合に出場した選手のみ(チーム全体の所属人数ではない。
 *   boxByPlayer=player_game_stats/player_practice_game_statsビューに行がある選手=stat_eventsがある、
 *   または出場時間が1秒でもある選手)。相手チームは常に空配列(NOT_RECORDED。相手の選手名簿はDBに存在しない)
 * @property {string|null} coach - 常にnull(NOT_RECORDED。コーチ氏名を入力する仕組みがアプリに無い)
 * @property {string|null} assistantCoach - 常にnull(NOT_RECORDED)
 * @property {number} timeoutsRemaining - games.home/away_timeouts_remaining(最終時点の残数)
 * @property {number} timeoutsTotal - 初期付与数(5固定。DBのデフォルト値)
 * @property {number} timeoutsUsed - DERIVABLE: timeoutsTotal - timeoutsRemaining。
 *   「何分(第何クォーター)に取ったか」の履歴は保存されていないため、使用数の合計のみ(NOT_RECORDED: per-timeout timing)
 * @property {ScoreSheetQuarterFoul[]} teamFoulsByPeriod - 自チームのみDERIVABLE
 *   (stat_events pf をクォーター別に集計)。相手チームは常に空配列
 *   (games.away_foulsはクォーター変更時に0リセットされる「現在のクォーターの值」のみの
 *   カウンターで、過去クォーターの履歴を保持しないため使用しない)
 * @property {number[]} quarterScores - 到達したクォーターの数だけ要素を持つ。
 *   自チームはDERIVABLE(stat_eventsの得点をクォーター別に集計)。
 *   相手チームはopponent_score_eventsが1件でも記録されていればDERIVABLE
 *   (同様にクォーター別集計)、無ければ空配列(NOT_RECORDED。この機能導入前の試合等)
 * @property {number} finalScore
 */

/**
 * @typedef {Object} ScoreSheetScoringEvent - 自チームの得点イベントの時系列(=ランニングスコア)。
 *   DERIVABLE(stat_events を created_at 順に並べ、make系イベントのみ抽出)。
 *   相手チームの得点はイベント単位のデータが存在しないため、この配列には出現しない
 *   (NOT_RECORDED: opponent scoring events)。ゲームクロック(そのプレイ時点の残り時間)も
 *   stat_eventsに保存されていないため含まない(NOT_RECORDED: game clock per event)。
 * @property {string} id
 * @property {number} sequence - 1始まりの通し番号(DERIVABLE: created_at順の並び)
 * @property {number} period
 * @property {string} playerId
 * @property {number|null} playerNumber
 * @property {string} playerName
 * @property {'FT'|'2PT'|'3PT'} type
 * @property {number} points - 1 | 2 | 3
 * @property {number} runningScoreSelf - このプレイ時点での自チームの累計得点
 */

/**
 * @typedef {Object} ScoreSheetOpponentScoringEvent - 相手チームの得点イベントの時系列。
 *   DERIVABLE(opponent_score_eventsをcreated_at順に並べたもの)。相手チームの選手名簿は
 *   管理していないため、プレイヤー単位の紐付けは持たない(誰が決めたかは記録しない)。
 *   opponent_score_eventsが導入される前に終了した試合には存在しない(空配列)。
 * @property {string} id
 * @property {number} sequence
 * @property {number} period
 * @property {'FT'|'2PT'|'3PT'} type
 * @property {number} points
 * @property {number} runningScoreOpponent
 */

/**
 * @typedef {Object} ScoreSheetOfficials - すべて常にnull(NOT_RECORDED)。
 *   審判・スコアラー等の担当者名を入力する仕組みが現状のアプリに無いため。
 *   将来入力UIを追加する場合に備え、フィールド自体はFIBA Appendix Bの構成に合わせて残す。
 * @property {string|null} scorer
 * @property {string|null} assistantScorer
 * @property {string|null} timer
 * @property {string|null} shotClockOperator
 * @property {string|null} crewChief
 * @property {string|null} umpire1
 * @property {string|null} umpire2
 */

/**
 * @typedef {Object} ScoreSheetResult
 * @property {number} finalScoreSelf
 * @property {number} finalScoreOpponent
 * @property {'self'|'opponent'|'tie'|null} winner - statusが'final'でない場合はnull
 */

/**
 * @typedef {Object} ScoreSheetViewModel
 * @property {ScoreSheetGameInfo} game
 * @property {ScoreSheetTeamSide} teamA - 自チーム(home)
 * @property {ScoreSheetTeamSide} teamB - 相手チーム(away)
 * @property {ScoreSheetScoringEvent[]} scoringEvents
 * @property {ScoreSheetOpponentScoringEvent[]} opponentScoringEvents
 * @property {ScoreSheetOfficials} officials
 * @property {ScoreSheetResult} result
 * @property {string} generatedAt - ISO文字列。表示のたびに都度生成される(DBやStorageに保存しない)
 */

export {}
