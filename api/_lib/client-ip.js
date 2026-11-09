// 送信元のIPアドレス(回数制限・重複判定に使う)。
// Vercel が付ける専用のヘッダー(x-vercel-forwarded-for / x-real-ip)を優先する。
// 利用者が自分で付けられる x-forwarded-for の先頭は、Vercel 以外の環境向けの予備としてだけ使う
export function getClientIp(req) {
  const headers = req.headers ?? {}
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip']) {
    const value = headers[name]
    if (typeof value === 'string' && value.trim()) return value.split(',')[0].trim()
  }
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}
