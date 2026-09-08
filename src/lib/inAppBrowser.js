// LINE・Instagram・Facebook等のアプリ内ブラウザ(WebView)は、システム標準のSafari/Chromeとは
// 別のストレージ領域を使うため、同じURLを開いても匿名アカウントの端末情報が共有されない。
// アプリ内ブラウザを検出し、正しいブラウザで開き直すよう案内するために使う。
const IN_APP_BROWSER_PATTERNS = [
  { name: 'LINE', pattern: /\bLine\//i },
  { name: 'Instagram', pattern: /\bInstagram\b/i },
  { name: 'Facebook', pattern: /FBAN|FBAV/i },
  { name: 'X(Twitter)', pattern: /\bTwitter\b/i },
  { name: 'KakaoTalk', pattern: /KAKAOTALK/i },
]

export function detectInAppBrowser() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const match = IN_APP_BROWSER_PATTERNS.find(({ pattern }) => pattern.test(ua))
  return match?.name ?? null
}

// アプリ内ブラウザによっては、特定のURLスキーム/クエリパラメータを使うことで
// システム標準のSafari/Chromeを直接開かせることができる。
// - LINE: 開いているURLに openExternalBrowser=1 を付けて遷移すると、LINE側が検知して
//   外部ブラウザで開き直してくれる(公式に文書化された挙動ではないが広く使われている)
// - KakaoTalk: 専用のURLスキームで外部ブラウザ起動を要求できる
// Instagram/Facebook/X等は同種の仕組みが存在しないため、その場合はnullを返す
// (呼び出し側でURLコピー等のフォールバックに切り替える)
export function getExternalBrowserUrl(appName) {
  if (typeof window === 'undefined') return null
  const currentUrl = window.location.href

  if (appName === 'LINE') {
    const url = new URL(currentUrl)
    url.searchParams.set('openExternalBrowser', '1')
    return url.toString()
  }

  if (appName === 'KakaoTalk') {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`
  }

  return null
}
