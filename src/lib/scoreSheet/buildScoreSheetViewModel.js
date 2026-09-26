// Supabase → ScoreSheetViewModel のmapper/service。
// ScoreSheet.jsx(表示側)はSupabaseの行を直接参照せず、必ずこの関数が返す
// 正規化済みのViewModelだけを見る(scoreSheetTypes.js参照)。
//
// 【最重要】存在しないデータを推測で埋めない。DBに保存されていない項目は
// null/空配列のまま返し、表示側で「—」や案内文を出す(scoreSheetTypes.jsの
// 各フィールドのコメントに、NOT_RECORDEDとした理由を明記している)。
//
// クエリ数を絞るため、まずgamesを1件取得し、そこから得たteam_id/tournament_id/
// game_typeを使って残りを並列取得する(2ラウンドトリップ、N+1なし)。

import { supabase } from '@/supabaseClient'

const STAT_POINTS = { fg2_make: 2, fg3_make: 3, ft_make: 1 }
const STAT_TYPE_LABEL = { fg2_make: '2PT', fg3_make: '3PT', ft_make: 'FT' }
// games.home/away_timeouts_remaining の初期値(supabase/schema.sql参照)。
// 「使用数」はここからの差分としてのみ算出できる導出値であり、DBに保存された生の値ではない。
const DEFAULT_TIMEOUTS = 5

function emptyStatLine() {
  return {
    pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, twoPm: 0, twoPa: 0,
    ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
    plusMinus: 0,
  }
}

function toStatLine(row) {
  if (!row) return emptyStatLine()
  return {
    pts: row.pts ?? 0,
    fgm: row.fgm ?? 0,
    fga: row.fga ?? 0,
    tpm: row.tpm ?? 0,
    tpa: row.tpa ?? 0,
    twoPm: (row.fgm ?? 0) - (row.tpm ?? 0),
    twoPa: (row.fga ?? 0) - (row.tpa ?? 0),
    ftm: row.ftm ?? 0,
    fta: row.fta ?? 0,
    oreb: row.oreb ?? 0,
    dreb: row.dreb ?? 0,
    reb: row.reb ?? 0,
    ast: row.ast ?? 0,
    stl: row.stl ?? 0,
    blk: row.blk ?? 0,
    tov: row.tov ?? 0,
    pf: row.pf ?? 0,
    plusMinus: row.plus_minus ?? 0,
  }
}

// 到達した最終クォーター(games.quarter)の数だけ要素を持つ配列を作る
function buildQuarterScores(pointsByQuarter, lastPeriod) {
  const scores = []
  for (let q = 1; q <= lastPeriod; q++) scores.push(pointsByQuarter.get(q) ?? 0)
  return scores
}

export class ScoreSheetAccessError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ScoreSheetAccessError'
  }
}

/**
 * @param {string} gameId
 * @returns {Promise<import('./scoreSheetTypes.js').ScoreSheetViewModel>}
 */
export async function buildScoreSheetViewModel(gameId) {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle()

  if (gameError) throw gameError
  // RLSにより、所属していないチームの試合はここで0件(null)として返る
  // (別チームのデータが漏れることはない)
  if (!game) throw new ScoreSheetAccessError('この試合が見つからないか、閲覧権限がありません')

  const boxScoreTable = game.game_type === 'practice' ? 'player_practice_game_stats' : 'player_game_stats'

  const [teamRes, tournamentRes, playersRes, eventsRes, lineupsRes, boxRes] = await Promise.all([
    supabase.from('teams').select('id, name').eq('id', game.team_id).maybeSingle(),
    game.tournament_id
      ? supabase.from('tournaments').select('id, name').eq('id', game.tournament_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('players')
      .select('id, number, name, guest_game_id')
      .eq('team_id', game.team_id)
      .order('sort_order')
      .order('number')
      .order('created_at'),
    supabase.from('stat_events').select('*').eq('game_id', gameId).order('created_at'),
    supabase.from('game_lineups').select('*').eq('game_id', gameId),
    game.game_type === 'shooting'
      ? Promise.resolve({ data: [], error: null })
      : supabase.from(boxScoreTable).select('*').eq('game_id', gameId),
  ])

  for (const res of [teamRes, tournamentRes, playersRes, eventsRes, lineupsRes, boxRes]) {
    if (res.error) throw res.error
  }

  // 相手チームの得点イベント(opponent_score_events)。マイグレーション未適用の環境では
  // テーブルが存在せずエラーになり得るため、他の取得とは切り離し、失敗しても
  // スコアシート全体は表示できるよう空配列にフォールバックする
  const opponentEventsRes = await supabase.from('opponent_score_events').select('*').eq('game_id', gameId).order('created_at')
  if (opponentEventsRes.error) {
    console.error('相手チームの得点イベントの取得に失敗しました', opponentEventsRes.error)
  }
  const opponentEvents = opponentEventsRes.data ?? []

  const team = teamRes.data
  const tournament = tournamentRes.data
  // この試合のロスター: 通常の選手全員 + この試合限定のゲスト(GameDetail.jsxと同じフィルタ)
  const gamePlayers = (playersRes.data ?? []).filter((p) => !p.guest_game_id || p.guest_game_id === gameId)
  const events = eventsRes.data ?? []
  const lineups = lineupsRes.data ?? []
  const boxByPlayer = new Map((boxRes.data ?? []).map((row) => [row.player_id, row]))
  const lineupByPlayer = new Map(lineups.map((l) => [l.player_id, l]))

  const lastPeriod = Math.max(1, game.quarter ?? 1)

  // --- 自チーム: クォーター別得点・クォーター別チームファウルをstat_eventsから集計 ---
  const pointsByQuarter = new Map()
  const foulCountByQuarter = new Map()
  // 選手別・クォーター別の個人ファウル数
  const playerFoulsByQuarterByPlayer = new Map() // playerId -> Map(quarter -> count)
  // 選手別・個人ファウルの発生順シーケンス(何本目のファウルが第何クォーターで起きたか)。
  // stat_eventsにファウル種別(P/T/U/D)の区別が無いため、公式スコアシートの
  // 「ファウルボックスに種別コードを書く」代わりに、クォーター番号を記入する形で代替する。
  const playerFoulSequenceByPlayer = new Map() // playerId -> number[](period)

  for (const e of events) {
    const pts = STAT_POINTS[e.stat_key]
    if (pts) {
      pointsByQuarter.set(e.quarter, (pointsByQuarter.get(e.quarter) ?? 0) + pts)
    }
    if (e.stat_key === 'pf') {
      foulCountByQuarter.set(e.quarter, (foulCountByQuarter.get(e.quarter) ?? 0) + 1)
      if (!playerFoulsByQuarterByPlayer.has(e.player_id)) {
        playerFoulsByQuarterByPlayer.set(e.player_id, new Map())
      }
      const perPlayer = playerFoulsByQuarterByPlayer.get(e.player_id)
      perPlayer.set(e.quarter, (perPlayer.get(e.quarter) ?? 0) + 1)

      if (!playerFoulSequenceByPlayer.has(e.player_id)) playerFoulSequenceByPlayer.set(e.player_id, [])
      playerFoulSequenceByPlayer.get(e.player_id).push(e.quarter)
    }
  }

  const teamFoulsByPeriod = []
  for (let q = 1; q <= lastPeriod; q++) {
    teamFoulsByPeriod.push({ period: q, count: foulCountByQuarter.get(q) ?? 0 })
  }

  // --- 自チームの得点イベント時系列(ランニングスコア) ---
  const playerById = new Map(gamePlayers.map((p) => [p.id, p]))
  let runningTotal = 0
  let sequence = 0
  const scoringEvents = []
  for (const e of events) {
    const pts = STAT_POINTS[e.stat_key]
    if (!pts) continue
    runningTotal += pts
    sequence += 1
    const player = playerById.get(e.player_id)
    scoringEvents.push({
      id: e.id,
      sequence,
      period: e.quarter,
      playerId: e.player_id,
      playerNumber: player?.number ?? null,
      playerName: player?.name ?? '(削除された選手)',
      type: STAT_TYPE_LABEL[e.stat_key],
      points: pts,
      runningScoreSelf: runningTotal,
    })
  }

  // --- 相手チームの得点イベント時系列(opponent_score_events由来)。
  // 選手名簿が無いため、プレイヤー番号は持たない(誰が決めたかは記録しない) ---
  let opponentRunningTotal = 0
  let opponentSequence = 0
  const opponentScoringEvents = []
  const opponentPointsByQuarter = new Map()
  for (const e of opponentEvents) {
    const pts = STAT_POINTS[e.stat_key]
    if (!pts) continue
    opponentRunningTotal += pts
    opponentSequence += 1
    opponentScoringEvents.push({
      id: e.id,
      sequence: opponentSequence,
      period: e.quarter,
      type: STAT_TYPE_LABEL[e.stat_key],
      points: pts,
      runningScoreOpponent: opponentRunningTotal,
    })
    opponentPointsByQuarter.set(e.quarter, (opponentPointsByQuarter.get(e.quarter) ?? 0) + pts)
  }

  // --- 選手一覧(自チームのみ。相手チームは選手名簿がDBに存在しない)。
  // 「チームに所属する全選手」ではなく「この試合に出場した選手」のみを対象にする。
  // boxByPlayerはplayer_game_stats/player_practice_game_statsビュー由来で、
  // stat_eventsがある、または出場時間(seconds_played)が1秒でもある選手のみ行を持つ
  // (migrations/030_appeared_players_stats.sql参照。GameDetail.jsxのrows算出と同じ判定)。
  // gamePlayers自体はチーム全所属選手+この試合限定のゲストなので、フィルタせずに
  // 使うと出場していないベンチ外の選手までスコアシートに載ってしまう。
  const players = gamePlayers.filter((p) => boxByPlayer.has(p.id)).map((p) => {
    const quarterFoulMap = playerFoulsByQuarterByPlayer.get(p.id) ?? new Map()
    const foulsByPeriod = []
    for (let q = 1; q <= lastPeriod; q++) foulsByPeriod.push({ period: q, count: quarterFoulMap.get(q) ?? 0 })
    return {
      id: p.id,
      number: p.number,
      name: p.name,
      isGuest: !!p.guest_game_id,
      startedOnCourt: lineupByPlayer.get(p.id)?.on_court ?? false,
      isCaptain: false,
      secondsPlayed: lineupByPlayer.get(p.id)?.seconds_played ?? 0,
      stats: toStatLine(boxByPlayer.get(p.id)),
      foulsByPeriod,
      foulSequence: playerFoulSequenceByPlayer.get(p.id) ?? [],
    }
  })

  const finalScoreSelf = players.reduce((sum, p) => sum + p.stats.pts, 0)
  const finalScoreOpponent = game.opponent_score ?? 0

  const homeTimeoutsRemaining = game.home_timeouts_remaining ?? DEFAULT_TIMEOUTS
  const awayTimeoutsRemaining = game.away_timeouts_remaining ?? DEFAULT_TIMEOUTS

  const teamA = {
    teamId: game.team_id,
    name: team?.name ?? '自チーム',
    isSelf: true,
    players,
    // コーチ・アシスタントコーチの氏名を入力する仕組みが現状のアプリに無いため常にnull(NOT_RECORDED)。
    // JBA公式スコアシートでは各チームの選手欄の下にコーチ欄があるため、フィールド自体は残す。
    coach: null,
    assistantCoach: null,
    timeoutsRemaining: homeTimeoutsRemaining,
    timeoutsTotal: DEFAULT_TIMEOUTS,
    timeoutsUsed: Math.max(0, DEFAULT_TIMEOUTS - homeTimeoutsRemaining),
    teamFoulsByPeriod,
    quarterScores: buildQuarterScores(pointsByQuarter, lastPeriod),
    finalScore: finalScoreSelf,
  }

  const teamB = {
    teamId: null,
    name: game.opponent_name || '(相手チーム)',
    isSelf: false,
    players: [],
    coach: null,
    assistantCoach: null,
    timeoutsRemaining: awayTimeoutsRemaining,
    timeoutsTotal: DEFAULT_TIMEOUTS,
    timeoutsUsed: Math.max(0, DEFAULT_TIMEOUTS - awayTimeoutsRemaining),
    teamFoulsByPeriod: [],
    // opponent_score_eventsが記録されている試合のみ、クォーター別得点をDERIVABLEにする。
    // イベントが1件も無い試合(この機能導入前の試合)は空配列のまま(NOT_RECORDED)。
    quarterScores: opponentEvents.length > 0 ? buildQuarterScores(opponentPointsByQuarter, lastPeriod) : [],
    finalScore: finalScoreOpponent,
  }

  let winner = null
  if (game.status === 'final') {
    if (finalScoreSelf > finalScoreOpponent) winner = 'self'
    else if (finalScoreSelf < finalScoreOpponent) winner = 'opponent'
    else winner = 'tie'
  }

  return {
    game: {
      id: game.id,
      competition: tournament?.name ?? null,
      gameNumber: null,
      date: game.game_date,
      startTime: null,
      endTime: null,
      place: game.location ?? null,
      gameType: game.game_type,
      periodSystem: game.period_system,
      lastPeriod,
      status: game.status,
    },
    teamA,
    teamB,
    scoringEvents,
    opponentScoringEvents,
    officials: {
      scorer: null,
      assistantScorer: null,
      timer: null,
      shotClockOperator: null,
      crewChief: null,
      umpire1: null,
      umpire2: null,
    },
    result: {
      finalScoreSelf,
      finalScoreOpponent,
      winner,
    },
    generatedAt: new Date().toISOString(),
  }
}
