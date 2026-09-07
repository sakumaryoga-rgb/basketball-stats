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

// Postgres関数(RPC)を呼び出す。日次・月次AI利用枠の確認+消費はここを経由し、
// SELECT確認→後からINSERTという競合しうる方式を避け、DB側の行ロックでアトミックに処理する。
export async function supabaseRpc(fn, args) {
  const response = await supabaseRequest(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    body: args,
  })
  return response.json()
}

function jstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

// JST(UTC+9, 夏時間なし)の暦日の開始時刻をUTCのISO文字列で返す
export function jstDayStartUtcIso(offsetDays = 0) {
  const jst = jstNow()
  jst.setUTCHours(0, 0, 0, 0)
  jst.setUTCDate(jst.getUTCDate() + offsetDays)
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

// JST(UTC+9, 夏時間なし)の暦月の開始時刻をUTCのISO文字列で返す
export function jstMonthStartUtcIso() {
  const jst = jstNow()
  jst.setUTCHours(0, 0, 0, 0)
  jst.setUTCDate(1)
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

// JST暦日キー("YYYY-MM-DD")。contact_ai_usageのperiod_key(daily)に使う。
export function jstDateKey() {
  return jstNow().toISOString().slice(0, 10)
}

// JST暦月キー("YYYY-MM")。contact_ai_usageのperiod_key(monthly)に使う。
export function jstMonthKey() {
  return jstNow().toISOString().slice(0, 7)
}

// contact_ai_usageから「Anthropic API呼び出し試行件数」(課金上限の基準)を読み取る。
// 読み取りだけなので行ロックは不要(枠の消費はcontact_try_consume_ai_quota RPC側で行う)。
export async function getAiUsageCount(periodType, periodKey) {
  const response = await supabaseRequest(
    `/rest/v1/contact_ai_usage?period_type=eq.${periodType}&period_key=eq.${periodKey}&select=count`
  )
  const rows = await response.json()
  return rows[0]?.count ?? 0
}
