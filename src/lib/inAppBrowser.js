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
