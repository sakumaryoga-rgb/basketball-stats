import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { isGuest } from '@/lib/roster'

const SUM_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']

function emptyBucket() {
  // gamePts: その試合でチームが実際に取った得点(ゲストの得点も含む)。TEAMのAVG PTS(PPG)に使う
  return { gamesPlayed: 0, gamePts: 0, totals: Object.fromEntries(SUM_KEYS.map((k) => [k, 0])) }
}

// チームの成績を、2Q制/4Q制それぞれと全公式戦(all)で集計する。TEAM画面の1試合平均は
// '2q'/'4q'、シュート成功率とシーズン合計は'all'を使う。各試合のplayer_game_stats(選手ごとの行)を
// 合算するが、ゲスト選手(players.guest_game_id付き=その試合限定の助っ人)の行は除く。
// 例外としてgamePts(TEAMのAVG PTS用)だけはゲストの得点も含める。AVG PTSは「その試合で
// チームが実際に取った得点」の平均であり、試合の最終スコア・GAMESのAVG PTSと一致させるため。
// ゲストは「その試合の参加者」であり、試合をまたぐチームの公式集計(TEAMの1試合平均・
// シーズン合計・シュート成功率)には含めない。player_season_stats(個人成績)・LEADERS・
// ホットゾーン(useShotChart)と同じ扱いで、3つの数字の対象範囲がそろう。
// 一方、その試合のスコア(試合画面・試合一覧・スコアシート)にはゲストの得点も含まれる。
// 試合数は{status !== 'scheduled'}の公式試合をperiod_systemごとに数える
export function useTeamPeriodStats(teamId) {
  const [stats, setStats] = useState({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }
    // loadingは初回読み込みの間だけtrueにする(stat_eventsの変更通知による再集計のたびに
    // TEAM画面の成績表示が一瞬消えないようにするため)

    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, status, period_system')
      .eq('team_id', teamId)
      .eq('game_type', 'official')

    if (gamesError) {
      console.error('試合一覧の取得に失敗しました', gamesError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    const playedGames = (games ?? []).filter((g) => g.status !== 'scheduled')
    const gameIds = playedGames.map((g) => g.id)

    if (gameIds.length === 0) {
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    const { data: boxRows, error: boxError } = await supabase
      .from('player_game_stats')
      .select('*')
      .in('game_id', gameIds)

    if (boxError) {
      console.error('チームスタッツの取得に失敗しました', boxError)
      setStats({ '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() })
      setLoading(false)
      return
    }

    // ゲスト選手のIDを集めて、チーム集計から除く
    const { data: teamPlayers, error: playersError } = await supabase
      .from('players')
      .select('id, guest_game_id')
      .eq('team_id', teamId)
    if (playersError) console.error('選手一覧の取得に失敗しました', playersError)
    const guestIds = new Set((teamPlayers ?? []).filter(isGuest).map((p) => p.id))

    const periodSystemByGame = new Map(playedGames.map((g) => [g.id, g.period_system]))
    const result = { '2q': emptyBucket(), '4q': emptyBucket(), all: emptyBucket() }

    // 試合数は(スタッツが1件も無い試合も含め)プレイ済みの試合数そのものを数える。
    // 合計値だけをスタッツ側から積み上げる
    for (const game of playedGames) {
      if (result[game.period_system]) result[game.period_system].gamesPlayed += 1
      result.all.gamesPlayed += 1
    }
    for (const row of boxRows ?? []) {
      const periodSystem = periodSystemByGame.get(row.game_id)
      if (!periodSystem) continue
      const bucket = result[periodSystem]
      if (bucket) bucket.gamePts += row.pts ?? 0
      result.all.gamePts += row.pts ?? 0
      if (guestIds.has(row.player_id)) continue
      for (const k of SUM_KEYS) {
        if (bucket) bucket.totals[k] += row[k] ?? 0
        result.all.totals[k] += row[k] ?? 0
      }
    }

    setStats(result)
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId) return
    const channel = supabase
      .channel(`team-period-stats-${teamId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, refresh])

  return { stats, loading }
}
