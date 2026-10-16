import { useEffect, useState } from 'react'
import { supabase } from '@/supabaseClient'

// 試合一覧で勝敗・スコアを一目で分かるようにするため、自チームの得点(選手ごとのptsの合計、
// GameDetail.jsxのteamScore算出と同じ考え方)を試合IDごとにまとめて取得する
// スクリメージ(practice)はplayer_practice_game_statsビューに集計されるため、tableで切り替える
export function useTeamScoresByGame(gameIds, table = 'player_game_stats') {
  const [scores, setScores] = useState({})
  const key = gameIds.join(',')

  useEffect(() => {
    if (!key) {
      setScores({})
      return
    }
    let cancelled = false
    supabase
      .from(table)
      .select('game_id, pts')
      .in('game_id', key.split(','))
      .then(({ data, error }) => {
        if (error) {
          console.error('試合スコアの取得に失敗しました', error)
          return
        }
        if (cancelled) return
        const totals = {}
        for (const row of data ?? []) totals[row.game_id] = (totals[row.game_id] ?? 0) + row.pts
        setScores(totals)
      })
    return () => {
      cancelled = true
    }
  }, [key, table])

  return scores
}
