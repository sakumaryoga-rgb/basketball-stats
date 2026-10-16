// 共有URLなどをクリップボードへコピーする。LINE等のアプリ内ブラウザや古いiOSでは
// navigator.clipboardが使えない/拒否されることがあるため、textarea+execCommandへフォールバックする
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // フォールバックへ進む
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

// 画面表示用に共有URLを短くする(コピーされる値は常に完全なURL)。
// 例: basketball-stats.vercel.app/t/AbC123…wxYz
export function shortenShareUrl(url) {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/^\/t\/([^/]+)/)
    if (!match) return `${u.host}${u.pathname}`
    const token = match[1]
    const short = token.length > 12 ? `${token.slice(0, 6)}…${token.slice(-4)}` : token
    return `${u.host}/t/${short}`
  } catch {
    return url
  }
}
