// 管理ダッシュボードのログアウト。セッションCookieを即時失効させるだけの薄いエンドポイント。

import { ADMIN_SESSION_COOKIE } from '../_lib/admin-shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
  )
  res.status(200).json({ ok: true })
}
