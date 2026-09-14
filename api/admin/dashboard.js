// 運営者専用ダッシュボード(/admin)向けの集計API。Read Only。
// 認証は管理者ログイン(api/admin/login.js)で発行された署名付きセッションCookieのみ
// (service role key・ADMIN_STATS_SECRET自体はフロントエンドへ一切渡さない)。
//
// 「問い合わせの未対応件数」のみ、Supabaseに保存していない値(ステータス)のためNotionへ
// 直接問い合わせる。それ以外はすべてSupabase(service role)から取得する。

import { AI_STATUS, jstDayStartUtcIso, jstMonthStartUtcIso } from '../_lib/contact-shared.js'
import { ADMIN_SESSION_COOKIE, countRows, parseCookies, rpc, selectRows, verifyAdminSessionCookieValue } from '../_lib/admin-shared.js'

const NOTION_VERSION = '2022-06-28'
const SPAM_TEAMS_PER_HOUR_THRESHOLD = 5
const SPAM_TEAMS_PER_USER_THRESHOLD = 5

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

// 前月比(MAU・月間PV)用。JST暦月の「前月1ヶ月間だけ」の範囲を返す
function jstPrevMonthRange() {
  const currentMonthStart = new Date(jstMonthStartUtcIso())
  const prevMonthStart = new Date(currentMonthStart)
  prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1)
  return { since: prevMonthStart.toISOString(), until: currentMonthStart.toISOString() }
}

// 1つの指標の取得失敗がダッシュボード全体を落とさないよう、失敗時はnullにフォールバックする
async function safe(promise, label) {
  try {
    return await promise
  } catch (err) {
    console.error(`管理ダッシュボード: ${label}の取得に失敗しました`, err)
    return null
  }
}

async function countContactByType() {
  const rows = await selectRows('contact_submissions', 'select=inquiry_type')
  const tally = {}
  for (const row of rows) {
    const key = row.inquiry_type || '未分類'
    tally[key] = (tally[key] || 0) + 1
  }
  return tally
}

async function countNotionUnhandled() {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) return null
  let count = 0
  let cursor
  do {
    const body = { filter: { property: 'ステータス', select: { equals: '未対応' } }, page_size: 100 }
    if (cursor) body.start_cursor = cursor
    const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Notion API error: ${response.status} ${await response.text()}`)
    const data = await response.json()
    count += data.results.length
    cursor = data.has_more ? data.next_cursor : null
  } while (cursor)
  return count
}

async function recentTeams() {
  return selectRows('teams', 'select=id,name,created_at&order=created_at.desc&limit=10')
}

// スパム兆候: 個人開発規模で運用確認できれば十分な、単純なしきい値判定のみ
async function spamSignals() {
  const [teamsLastHour, memberships] = await Promise.all([
    countRows('teams', `created_at=gte.${hoursAgoIso(1)}`),
    selectRows('team_members', 'select=user_id'),
  ])

  const perUserTeamCount = {}
  for (const row of memberships) {
    perUserTeamCount[row.user_id] = (perUserTeamCount[row.user_id] || 0) + 1
  }
  const usersWithManyTeams = Object.entries(perUserTeamCount)
    .filter(([, count]) => count >= SPAM_TEAMS_PER_USER_THRESHOLD)
    .map(([userId, count]) => ({ userId, teamCount: count }))
    .sort((a, b) => b.teamCount - a.teamCount)
    .slice(0, 10)

  return {
    teamsCreatedLastHour: teamsLastHour,
    teamsCreatedLastHourFlag: teamsLastHour >= SPAM_TEAMS_PER_HOUR_THRESHOLD,
    usersWithManyTeams,
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

  const since7d = daysAgoIso(7)
  const since30d = daysAgoIso(30)
  const since60d = daysAgoIso(60)
  const monthStart = jstMonthStartUtcIso()
  const dayStart = jstDayStartUtcIso()
  const prevMonth = jstPrevMonthRange()

  try {
    const [
      totalTeams,
      activeTeams30d,
      activeTeams30dPrev,
      teamMemberUserCount,
      dau,
      wau,
      mau,
      mauPrev,
      pvTotal,
      pvMonth,
      pvMonthPrev,
      pv7d,
      totalPlayers,
      officialGames,
      practiceGames,
      shootingGames,
      contactTotal,
      contactAiClassified,
      contactByType,
      contactRateLimited,
      contactUnhandled,
      teams,
      spam,
      storageUsage,
      errorsTotal,
      errors7d,
      errors30d,
    ] = await Promise.all([
      safe(countRows('teams'), '総チーム数'),
      safe(rpc('admin_distinct_team_count', { since: since30d }), 'アクティブチーム数'),
      safe(
        rpc('admin_distinct_team_count_range', { since: since60d, until: since30d }),
        'アクティブチーム数(前30日)'
      ),
      safe(rpc('admin_distinct_member_count'), 'チーム参加ユーザー数'),
      safe(rpc('admin_distinct_user_count', { since: dayStart }), 'DAU'),
      safe(rpc('admin_distinct_user_count', { since: since7d }), 'WAU'),
      safe(rpc('admin_distinct_user_count', { since: monthStart }), 'MAU'),
      safe(
        rpc('admin_distinct_user_count_range', { since: prevMonth.since, until: prevMonth.until }),
        'MAU(前月)'
      ),
      safe(countRows('page_views'), 'PV総数'),
      safe(countRows('page_views', `created_at=gte.${monthStart}`), '月間PV'),
      safe(
        countRows('page_views', `created_at=gte.${prevMonth.since}&created_at=lt.${prevMonth.until}`),
        '月間PV(前月)'
      ),
      safe(countRows('page_views', `created_at=gte.${since7d}`), '直近7日PV'),
      safe(countRows('players', 'guest_game_id=is.null'), '総選手数'),
      safe(countRows('games', 'game_type=eq.official'), '試合数'),
      safe(countRows('games', 'game_type=eq.practice'), '練習数'),
      safe(countRows('games', 'game_type=eq.shooting'), 'シューティング記録数'),
      safe(countRows('contact_submissions'), '問い合わせ総数'),
      safe(countRows('contact_submissions', 'ai_classified=eq.true'), 'AI分類件数'),
      safe(countContactByType(), '問い合わせ種別内訳'),
      safe(
        countRows('contact_submissions', `ai_status=eq.${encodeURIComponent(AI_STATUS.USER_LIMITED)}`),
        'レート制限件数'
      ),
      safe(countNotionUnhandled(), '問い合わせ未対応件数'),
      safe(recentTeams(), '最近作成されたチーム'),
      safe(spamSignals(), 'スパム兆候'),
      safe(rpc('admin_storage_usage'), 'Storage使用量'),
      safe(countRows('client_errors'), 'エラー総数'),
      safe(countRows('client_errors', `created_at=gte.${since7d}`), '直近7日エラー数'),
      safe(countRows('client_errors', `created_at=gte.${since30d}`), '直近30日エラー数'),
    ])

    res.status(200).json({
      usage: {
        totalTeams,
        activeTeams30d,
        activeTeams30dPrev,
        teamMemberUserCount,
        dau,
        wau,
        mau,
        mauPrev,
        pvTotal,
        pvMonth,
        pvMonthPrev,
        pv7d,
      },
      content: {
        totalPlayers,
        officialGames,
        practiceGames,
        shootingGames,
      },
      contact: {
        total: contactTotal,
        aiClassified: contactAiClassified,
        byType: contactByType,
        rateLimited: contactRateLimited,
        unhandled: contactUnhandled,
      },
      ops: {
        recentTeams: teams,
        spam,
        storageUsage,
        errors: { total: errorsTotal, last7d: errors7d, last30d: errors30d },
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('管理ダッシュボードの取得に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
