// Vercel Cron(1日1回)から起動する問い合わせデータのクリーンアップ処理。
// 1. ステータスが「対応済み」になったのに「対応完了日」が未設定のページに、今日の日付を設定する
// 2. 「対応完了日」から90日以上経過したページの「連絡先メール」を自動的に空にする
// Vercelがcron実行時に付与する Authorization: Bearer $CRON_SECRET で外部からの不正起動を防ぐ。

const NOTION_VERSION = '2022-06-28'
const RETENTION_DAYS = 90

async function notionFetch(path, { method = 'POST', body } = {}) {
  const response = await fetch(`https://api.notion.com${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

async function queryDatabase(filter) {
  const data = await notionFetch(`/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    body: { filter },
  })
  return data.results
}

async function updatePage(pageId, properties) {
  await notionFetch(`/v1/pages/${pageId}`, { method: 'PATCH', body: { properties } })
}

async function stampCompletionDates() {
  const pages = await queryDatabase({
    and: [
      { property: 'ステータス', select: { equals: '対応済み' } },
      { property: '対応完了日', date: { is_empty: true } },
    ],
  })
  const today = new Date().toISOString().slice(0, 10)
  for (const page of pages) {
    await updatePage(page.id, { 対応完了日: { date: { start: today } } })
  }
  return pages.length
}

async function clearExpiredEmails() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const pages = await queryDatabase({
    and: [
      { property: '対応完了日', date: { on_or_before: cutoffStr } },
      { property: '連絡先メール', email: { is_not_empty: true } },
    ],
  })
  for (const page of pages) {
    await updatePage(page.id, { 連絡先メール: { email: null } })
  }
  return pages.length
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  try {
    const stamped = await stampCompletionDates()
    const cleared = await clearExpiredEmails()
    res.status(200).json({ ok: true, stamped, cleared })
  } catch (err) {
    console.error('問い合わせクリーンアップに失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
