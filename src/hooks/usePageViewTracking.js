import { useEffect } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { supabase } from '@/supabaseClient'

// PV計測用にpathnameを正規化するためのルート一覧。App.jsxのRoute pathと対応させる。
// (:id等の動的セグメントを含んだままだとページ別集計が試合ごと・選手ごとにバラけてしまうため)
const ROUTE_PATTERNS = [
  '/onboarding',
  '/t/:token',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/operator',
  '/admin',
  '/games',
  '/games/t/:tournamentId',
  '/games/:id',
  '/practice',
  '/shooting/:id',
  '/players',
  '/players/:id',
  '/leaders',
  '/team',
]

function normalizePath(pathname) {
  for (const pattern of ROUTE_PATTERNS) {
    if (matchPath({ path: pattern, end: true }, pathname)) return pattern
  }
  return pathname
}

// pathnameが変わった時だけ1PVとして記録する(query string等は含めない)。
// visibility/focus/滞在時間/スクロール等は計測しない。
export function usePageViewTracking(userId, teamId) {
  const location = useLocation()
  const pathname = location.pathname

  useEffect(() => {
    if (!userId) return
    const path = normalizePath(pathname)
    supabase
      .from('page_views')
      .insert({ user_id: userId, team_id: teamId ?? null, path })
      .then(({ error }) => {
        if (error) console.error('PVの記録に失敗しました', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, userId])
}
