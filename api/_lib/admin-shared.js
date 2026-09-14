// 管理ダッシュボード(/admin, /api/admin/*)専用の共通ヘルパー。
// service role keyでのSupabaseアクセスはcontact-shared.jsのsupabaseRequestを再利用し、
// ここではdistinctカウントやCookie署名など管理ダッシュボード固有のロジックのみを持つ。

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { supabaseRequest } from './contact-shared.js'

export const ADMIN_SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12時間
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15分
const LOGIN_MAX_FAILURES = 5

export async function countRows(table, query = '') {
  const response = await supabaseRequest(`/rest/v1/${table}${query ? `?${query}` : ''}`, {
    headers: { prefer: 'count=exact', range: '0-0' },
  })
  const contentRange = response.headers.get('content-range')
  return Number(contentRange?.split('/')[1] ?? 0)
}

export async function selectRows(table, query) {
  const response = await supabaseRequest(`/rest/v1/${table}?${query}`)
  return response.json()
}

export async function rpc(fn, args = {}) {
  const response = await supabaseRequest(`/rest/v1/rpc/${fn}`, {
    method: 'POST',
    body: args,
  })
  return response.json()
}

// --- 署名付きセッションCookie(管理者は1人の前提。DB/セッションストアは持たない) ---

function sessionSecret() {
  // 署名鍵はADMIN_STATS_SECRETから導出し、新たな環境変数は増やさない
  return createHash('sha256').update(process.env.ADMIN_STATS_SECRET || '').digest()
}

export function createAdminSessionCookieValue() {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const payload = `admin.${expiresAt}`
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  return { value: `${payload}.${signature}`, maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000) }
}

export function verifyAdminSessionCookieValue(cookieValue) {
  if (!cookieValue) return false
  const lastDot = cookieValue.lastIndexOf('.')
  if (lastDot < 0) return false
  const payload = cookieValue.slice(0, lastDot)
  const signature = cookieValue.slice(lastDot + 1)
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  if (!safeEqualHex(signature, expected)) return false

  const [prefix, expiresAtStr] = payload.split('.')
  if (prefix !== 'admin') return false
  const expiresAt = Number(expiresAtStr)
  return Number.isFinite(expiresAt) && Date.now() < expiresAt
}

export function parseCookies(req) {
  const header = req.headers['cookie']
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

// 長さが異なりうる16進文字列同士の定数時間比較(timingSafeEqualは長さ不一致で例外を投げるため、
// 先に固定長のハッシュへ変換してから比較する)
function safeEqualHex(a, b) {
  const ah = createHash('sha256').update(String(a)).digest()
  const bh = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(ah, bh)
}

// パスワード自体の定数時間比較(長さの異なる入力でも例外を投げないよう、
// 両者をSHA-256ダイジェスト化してから比較する)
export function safeEqualString(a, b) {
  const ah = createHash('sha256').update(String(a ?? '')).digest()
  const bh = createHash('sha256').update(String(b ?? '')).digest()
  return timingSafeEqual(ah, bh)
}

export function hashIpForAdmin(ip) {
  return createHash('sha256').update(`admin:${ip}:${process.env.CONTACT_HASH_SALT || ''}`).digest('hex')
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

// 直近15分の「失敗した」ログイン試行が上限に達しているか(達していればtrue=拒否すべき)
export async function isLoginRateLimited(ipHash) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString()
  const count = await countRows('admin_login_attempts', `ip_hash=eq.${ipHash}&created_at=gte.${since}`)
  return count >= LOGIN_MAX_FAILURES
}

export async function recordLoginFailure(ipHash) {
  await supabaseRequest('/rest/v1/admin_login_attempts', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: [{ ip_hash: ipHash }],
  })
}
