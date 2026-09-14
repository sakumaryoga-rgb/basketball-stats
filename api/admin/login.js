// 管理ダッシュボードのログイン。ADMIN_STATS_SECRET(既存, 新規追加なし)と照合し、
// 一致すれば署名付きの短期セッションCookieを発行する。生の秘密鍵はブラウザに一切渡さない。
//
// レート制限は「直近15分以内に失敗したログインが5回に達したIPは、その後15分間
// (失敗件数が5件を下回るまで)すべての試行を429で拒否する」。成功したログインは記録しない。
// 処理順: 1.IPハッシュ生成 → 2.直近15分の失敗件数確認 → 3.5件以上なら即429(検証前) →
// 4.timingSafeEqualで比較 → 5.不一致なら記録して401 → 6.一致ならCookie発行(記録なし)

import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionCookieValue,
  safeEqualString,
  hashIpForAdmin,
  getClientIp,
  isLoginRateLimited,
  recordLoginFailure,
} from '../_lib/admin-shared.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  if (!process.env.ADMIN_STATS_SECRET) {
    res.status(500).json({ error: 'admin not configured' })
    return
  }

  const { password } = req.body ?? {}
  const ipHash = hashIpForAdmin(getClientIp(req))

  try {
    if (await isLoginRateLimited(ipHash)) {
      res.status(429).json({ error: 'too many attempts' })
      return
    }

    if (typeof password !== 'string' || !safeEqualString(password, process.env.ADMIN_STATS_SECRET)) {
      await recordLoginFailure(ipHash)
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const { value, maxAgeSeconds } = createAdminSessionCookieValue()
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_SESSION_COOKIE}=${value}; Path=/api/admin; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`
    )
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('管理者ログイン処理に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
