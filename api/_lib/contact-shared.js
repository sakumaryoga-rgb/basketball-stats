// api/contact.js と api/contact-stats.js で共有する定数・ユーティリティ。

export const APP_DAILY_AI_LIMIT = 100
export const APP_MONTHLY_AI_LIMIT = 2000

export async function supabaseRequest(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${process.env.VITE_SUPABASE_URL}${path}`
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const response = await fetch(url, {
    method,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(`Supabase API error: ${response.status} ${await response.text()}`)
  }
  return response
}

export async function supabaseCount(query) {
  const response = await supabaseRequest(`/rest/v1/contact_submissions?${query}`, {
    headers: { prefer: 'count=exact', range: '0-0' },
  })
  const contentRange = response.headers.get('content-range') // 例: "0-0/12"
  return Number(contentRange?.split('/')[1] ?? 0)
}

// JST(UTC+9, 夏時間なし)の暦日の開始時刻をUTCのISO文字列で返す
export function jstDayStartUtcIso(offsetDays = 0) {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCHours(0, 0, 0, 0)
  jst.setUTCDate(jst.getUTCDate() + offsetDays)
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

// JST(UTC+9, 夏時間なし)の暦月の開始時刻をUTCのISO文字列で返す
export function jstMonthStartUtcIso() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  jst.setUTCHours(0, 0, 0, 0)
  jst.setUTCDate(1)
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}
