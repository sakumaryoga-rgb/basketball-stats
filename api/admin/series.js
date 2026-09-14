// 管理ダッシュボードのグラフ用データ(期間切り替え対応)。Read Only。
// 認証はdashboard.jsと同じ署名付きセッションCookie。KPI・問い合わせ・運用確認等は含まず、
// 期間切り替えのたびにNotion API等まで叩き直さないよう、グラフ専用に分離している。

import { ADMIN_SESSION_COOKIE, parseCookies, rpc, verifyAdminSessionCookieValue } from '../_lib/admin-shared.js'

// 対応する期間はこの5種類のみ。フロントエンドの自由入力はここで必ず弾く
// (granularityはRPC側でdate_trunc()に渡るため、許可リスト以外を通さない)。
const PERIOD_CONFIG = {
  '30d': { granularity: 'day', days: 30 },
  '90d': { granularity: 'week', days: 90 },
  '1y': { granularity: 'month', days: 365 },
  '3y': { granularity: 'month', days: 365 * 3 },
  '5y': { granularity: 'quarter', days: 365 * 5 },
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function safe(promise, label) {
  try {
    return await promise
  } catch (err) {
    console.error(`管理ダッシュボード(グラフ): ${label}の取得に失敗しました`, err)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const cookies = parseCookies(req)
  if (!verifyAdminSessionCookieValue(cookies[ADMIN_SESSION_COOKIE])) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const period = PERIOD_CONFIG[req.query?.period] ? req.query.period : '30d'
  const { granularity, days } = PERIOD_CONFIG[period]
  const since = daysAgoIso(days)

  try {
    const [activeUsers, pageViews, gamesByType, pvByPage] = await Promise.all([
      safe(rpc('admin_active_users_series', { since, granularity }), 'アクティブユーザー推移'),
      safe(rpc('admin_page_views_series', { since, granularity }), 'PV推移'),
      safe(rpc('admin_games_series', { since, granularity }), '試合/練習/シューティング推移'),
      safe(rpc('admin_pv_by_page_range', { since }), 'ページ別PV'),
    ])

    res.status(200).json({ period, granularity, activeUsers, pageViews, gamesByType, pvByPage })
  } catch (err) {
    console.error('管理ダッシュボードのグラフデータ取得に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
