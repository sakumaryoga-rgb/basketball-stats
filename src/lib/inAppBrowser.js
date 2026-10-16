// LINE・Instagram・Facebook等のアプリ内ブラウザ(WebView)は、システム標準のSafari/Chromeとは
// 別のストレージ領域を使うため、同じURLを開いても匿名アカウントの端末情報が共有されない。
// アプリ内ブラウザを検出し、アプリを読み込む前に標準のブラウザへ移動させるために使う。
const IN_APP_BROWSER_PATTERNS = [
  { name: 'LINE', pattern: /\bLine\//i },
  { name: 'Instagram', pattern: /\bInstagram\b/i },
  { name: 'Facebook', pattern: /FBAN|FBAV/i },
  { name: 'X(Twitter)', pattern: /\bTwitter\b/i },
  { name: 'KakaoTalk', pattern: /KAKAOTALK/i },
]

// LINEに外部ブラウザで開き直させるためのクエリパラメータ
const LINE_EXTERNAL_PARAM = 'openExternalBrowser'
// 自動移動を試すのは1セッション1回まで(移動できなかった場合に無限に繰り返さないため)
const AUTO_REDIRECT_KEY = 'externalBrowserAutoRedirectTried'

export function detectInAppBrowser() {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  const match = IN_APP_BROWSER_PATTERNS.find(({ pattern }) => pattern.test(ua))
  return match?.name ?? null
}

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent || '')
}

// アプリ内ブラウザから、システム標準のブラウザを直接開かせるURLを返す。
// - LINE: openExternalBrowser=1 を付けたURLへ遷移すると、LINE側が外部ブラウザで開き直す
// - KakaoTalk: 専用のURLスキームで外部ブラウザ起動を要求できる
// - それ以外(Instagram/Facebook/X等): iOSはx-safari-httpsスキームでSafariを、Androidは
//   intent:// URLで標準ブラウザを起動する(アプリやOSのバージョンによっては効かないことがある)
// どの方法も使えない場合はnull(呼び出し側でURLコピー等のフォールバックに切り替える)
export function getExternalBrowserUrl(appName) {
  if (typeof window === 'undefined') return null
  const current = new URL(window.location.href)

  if (appName === 'LINE') {
    current.searchParams.set(LINE_EXTERNAL_PARAM, '1')
    return current.toString()
  }

  if (appName === 'KakaoTalk') {
    return `kakaotalk://web/openExternal?url=${encodeURIComponent(current.toString())}`
  }

  if (isIOS()) {
    return current.toString().replace(/^https:\/\//, 'x-safari-https://').replace(/^http:\/\//, 'x-safari-http://')
  }

  if (isAndroid()) {
    const scheme = current.protocol.replace(':', '')
    return `intent://${current.host}${current.pathname}${current.search}${current.hash}#Intent;scheme=${scheme};action=android.intent.action.VIEW;end`
  }

  return null
}

// アプリ内ブラウザで開かれた場合に、アプリ(匿名サインイン・共有URLでの自動参加など)を
// 読み込む前に一度だけ標準ブラウザへ移動させる。移動を試みた場合はtrueを返す。
// LINEでopenExternalBrowser=1付きのURLを開いたのにまだLINE内にいる場合は、LINE側が
// 対応していないとみなして再試行しない
export function tryAutoOpenExternalBrowser() {
  if (typeof window === 'undefined') return false
  const appName = detectInAppBrowser()
  if (!appName) return false
  const params = new URLSearchParams(window.location.search)
  if (appName === 'LINE' && params.get(LINE_EXTERNAL_PARAM) === '1') return false
  try {
    if (sessionStorage.getItem(AUTO_REDIRECT_KEY) === '1') return false
    sessionStorage.setItem(AUTO_REDIRECT_KEY, '1')
  } catch {
    // sessionStorageが使えない環境でも1回は試す
  }
  const externalUrl = getExternalBrowserUrl(appName)
  if (!externalUrl) return false
  window.location.href = externalUrl
  return true
}

// LINEから外部ブラウザへ移ってきた場合、URLに残るopenExternalBrowser=1を外す
// (共有URLのコピーやブックマークに混ざらないようにするため)
export function cleanExternalBrowserParam() {
  if (typeof window === 'undefined' || detectInAppBrowser()) return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(LINE_EXTERNAL_PARAM)) return
  url.searchParams.delete(LINE_EXTERNAL_PARAM)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
