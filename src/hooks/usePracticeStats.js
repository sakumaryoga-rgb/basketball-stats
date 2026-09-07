import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { useShotChart } from '@/hooks/useShotChart'
import { pct } from '@/lib/stats'
import { aggregateHotZones, aggregateHotZonesFromTallies, mergeHotZones, isThreePointZone } from '@/lib/hotZones'

const EMPTY_TOTALS = { fgm: 0, fga: 0, tpm: 0, tpa: 0 }

// 個人ページのPRACTICE表示用: スクリメージ(practice)とシューティング(shooting)を
// 合算したホットゾーン・簡易シュート成功率・それぞれの一覧を返す。
// 公式スタッツ(useShotChart/usePlayerLogのデフォルト)とは完全に独立している。
export function usePracticeStats(teamId, playerId) {
  const [practiceGames, setPracticeGames] = useState([])
  const [shootingSessions, setShootingSessions] = useState([])
  const [shootingTallies, setShootingTallies] = useState([])
  const [loading, setLoading] = useState(true)

  const { shots: practiceShots } = useShotChart(teamId, playerId, ['practice'])

  const refresh = useCallback(async () => {
    if (!playerId || !teamId) return
    setLoading(true)
    const [practiceStatsRes, practiceGamesRes, shootingGamesRes, shootingEntriesRes] = await Promise.all([
      supabase.from('player_practice_game_stats').select('*').eq('player_id', playerId),
      supabase.from('games').select('id, opponent_name, game_date, status').eq('team_id', teamId).eq('game_type', 'practice'),
      supabase.from('games').select('id, opponent_name, game_date').eq('team_id', teamId).eq('game_type', 'shooting'),
      supabase.from('shooting_entries').select('game_id, zone, attempts, makes').eq('player_id', playerId),
    ])
    if (practiceStatsRes.error) console.error('スクリメージ成績の取得に失敗しました', practiceStatsRes.error)
    if (practiceGamesRes.error) console.error('スクリメージ一覧の取得に失敗しました', practiceGamesRes.error)
    if (shootingGamesRes.error) console.error('シューティング一覧の取得に失敗しました', shootingGamesRes.error)
    if (shootingEntriesRes.error) console.error('シューティング記録の取得に失敗しました', shootingEntriesRes.error)

    const practiceGamesById = new Map((practiceGamesRes.data ?? []).map((g) => [g.id, g]))
    setPracticeGames(
      (practiceStatsRes.data ?? [])
        .filter((row) => practiceGamesById.has(row.game_id))
        .map((row) => ({ ...row, game: practiceGamesById.get(row.game_id) }))
        .sort((a, b) => (a.game.game_date < b.game.game_date ? 1 : -1))
    )

    const tallies = shootingEntriesRes.data ?? []
    setShootingTallies(tallies)

    const totalsByGame = new Map()
    for (const t of tallies) {
      const cur = totalsByGame.get(t.game_id) ?? { attempts: 0, makes: 0 }
      cur.attempts += t.attempts
      cur.makes += t.makes
      totalsByGame.set(t.game_id, cur)
    }
    setShootingSessions(
      (shootingGamesRes.data ?? [])
        .filter((g) => totalsByGame.has(g.id))
        .map((g) => ({ game: g, ...totalsByGame.get(g.id) }))
        .sort((a, b) => (a.game.game_date < b.game.game_date ? 1 : -1))
    )

    setLoading(false)
  }, [teamId, playerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!teamId || !playerId) return
    const channel = supabase
      .channel(`practice-stats-${teamId}-${playerId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `team_id=eq.${teamId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shooting_entries', filter: `player_id=eq.${playerId}` }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [teamId, playerId, refresh])

  const practiceTotals = practiceGames.reduce(
    (acc, row) => ({
      fgm: acc.fgm + row.fgm, fga: acc.fga + row.fga, tpm: acc.tpm + row.tpm, tpa: acc.tpa + row.tpa,
    }),
    { ...EMPTY_TOTALS }
  )

  const shootingTotals = shootingTallies.reduce(
    (acc, t) => {
      acc.fga += t.attempts
      acc.fgm += t.makes
      if (isThreePointZone(t.zone)) {
        acc.tpa += t.attempts
        acc.tpm += t.makes
      }
      return acc
    },
    { ...EMPTY_TOTALS }
  )

  const summary = {
    fgm: practiceTotals.fgm + shootingTotals.fgm,
    fga: practiceTotals.fga + shootingTotals.fga,
    tpm: practiceTotals.tpm + shootingTotals.tpm,
    tpa: practiceTotals.tpa + shootingTotals.tpa,
  }
  summary.fgPct = pct(summary.fgm, summary.fga)
  summary.tpPct = pct(summary.tpm, summary.tpa)

  const hotZones = mergeHotZones(aggregateHotZones(practiceShots), aggregateHotZonesFromTallies(shootingTallies))

  return { loading, practiceGames, shootingSessions, summary, hotZones, refresh }
}
