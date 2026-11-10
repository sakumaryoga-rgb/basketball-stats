// 開発者向けの表示領域の診断(iOSのホーム画面アプリで上部のぼかしがヘッダーに重なる問題の調査用)。
// 値の読み取りと、診断パネルからだけ操作できる「その場限りの実験」を扱う。
// - 実験は保存しない(JSで<html>に属性と<style>を付けるだけなので、再読み込みで必ず消える)
// - 診断パネルを閉じたとき・画面遷移したとき・ページを離れるときに必ず元に戻す
// - appHeight.js・既存のCSS・ヘッダー・下のメニューバーのコードには手を加えない
import { APP_VERSION } from '@/lib/appVersion'

const STYLE_ID = 'diag-experiments-style'
export const HEADER_EXTRA_OPTIONS = [0, 16, 24, 32]

// 実験の内容。<html>の属性が付いている間だけ効く
const EXPERIMENT_CSS = `
html[data-diag-header-extra] .app-shell > header {
  padding-top: calc(env(safe-area-inset-top) + var(--diag-header-extra, 0px)) !important;
}
html[data-diag-root-scroll='off'],
html[data-diag-root-scroll='off'] body {
  overflow-y: hidden !important;
}
html[data-diag-root-scroll='off'] .app-shell + div[aria-hidden='true'] {
  display: none !important;
}
`

let state = { open: false, headerExtra: 0, rootScrollOff: false, log: [] }
const listeners = new Set()
function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}
export function subscribeDiagnostics(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getDiagnosticsState() {
  return state
}

function applyExperimentsToDom() {
  const html = document.documentElement
  const active = state.headerExtra > 0 || state.rootScrollOff
  let style = document.getElementById(STYLE_ID)
  if (active && !style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = EXPERIMENT_CSS
    document.head.appendChild(style)
  }
  if (state.headerExtra > 0) {
    html.setAttribute('data-diag-header-extra', String(state.headerExtra))
    html.style.setProperty('--diag-header-extra', `${state.headerExtra}px`)
  } else {
    html.removeAttribute('data-diag-header-extra')
    html.style.removeProperty('--diag-header-extra')
  }
  if (state.rootScrollOff) html.setAttribute('data-diag-root-scroll', 'off')
  else html.removeAttribute('data-diag-root-scroll')
  if (!active) style?.remove()
}

// 実験の前後で比べる主な値
export function quickMetrics() {
  const de = document.documentElement
  const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect()
  const header = rect('.app-shell > header')
  const nav = rect('.app-shell > nav')
  return {
    'documentElement.scrollHeight': de.scrollHeight,
    'body.scrollHeight': document.body.scrollHeight,
    'scrollingElement.scrollHeight': document.scrollingElement?.scrollHeight,
    'window.scrollY': Math.round(window.scrollY * 100) / 100,
    'window.innerHeight': window.innerHeight,
    'ルートのスクロール可能量': Math.max(de.scrollHeight, document.body.scrollHeight) - window.innerHeight,
    'header.top / height': header ? `${round(header.top)} / ${round(header.height)}` : 'n/a',
    'nav.top / bottom': nav ? `${round(nav.top)} / ${round(nav.bottom)}` : 'n/a',
  }
}

function logExperiment(label, before) {
  // スタイルの反映後(次の描画)に測る
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      setState({ log: [...state.log, { label, before, after: quickMetrics() }].slice(-8) })
    })
  )
}

export function setHeaderExtra(px) {
  if (px === state.headerExtra) return
  const before = quickMetrics()
  setState({ headerExtra: px })
  applyExperimentsToDom()
  logExperiment(`実験A: ヘッダー上部 +${px}px`, before)
}

export function setRootScrollOff(off) {
  if (off === state.rootScrollOff) return
  const before = quickMetrics()
  setState({ rootScrollOff: off })
  applyExperimentsToDom()
  logExperiment(`実験B: ルートの縦スクロール停止 ${off ? 'ON' : 'OFF'}`, before)
}

// すべての実験を解除して元のCSSに戻す
export function resetExperiments() {
  if (state.headerExtra === 0 && !state.rootScrollOff) return
  setState({ headerExtra: 0, rootScrollOff: false })
  applyExperimentsToDom()
}

export function openDiagnostics() {
  setState({ open: true, log: [] })
}

export function closeDiagnostics() {
  resetExperiments()
  setState({ open: false, log: [] })
}

// ---- 診断値の読み取り ----

function round(n) {
  return typeof n === 'number' ? Math.round(n * 100) / 100 : String(n)
}

// 一時的な非表示の要素を置き、CSSの計算結果や位置を読み取ってすぐ消す
function withProbe(css, read) {
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = `visibility:hidden;pointer-events:none;${css}`
  document.body.appendChild(probe)
  try {
    return read(probe)
  } finally {
    probe.remove()
  }
}

const rectText = (r) => (r ? `top ${round(r.top)}, bottom ${round(r.bottom)}, height ${round(r.height)}` : 'n/a')

async function readManifestDisplay() {
  const href = document.querySelector('link[rel="manifest"]')?.href
  if (!href) return '(manifestのlinkなし)'
  try {
    const res = await fetch(href, { cache: 'no-store' })
    return (await res.json()).display ?? '(未設定)'
  } catch {
    return '(取得できませんでした)'
  }
}

export async function collectDiagnostics() {
  const ua = navigator.userAgent
  const isIOS = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const vv = window.visualViewport
  const de = document.documentElement
  const body = document.body
  const rootEl = document.getElementById('root')
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '(なし)'
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const insets = withProbe(
    'position:fixed;top:0;left:0;width:0;height:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);',
    (p) => ({ top: cs(p).paddingTop, bottom: cs(p).paddingBottom })
  )
  const unitHeight = (unit) => withProbe(`position:absolute;top:0;left:0;width:0;height:100${unit};`, (p) => round(p.getBoundingClientRect().height))
  const fixedFull = withProbe('position:fixed;top:0;bottom:0;left:0;width:0;', (p) => p.getBoundingClientRect())
  const fixedBottom = withProbe('position:fixed;bottom:0;left:0;width:0;height:0;', (p) => p.getBoundingClientRect())
  const orientation =
    screen.orientation?.type ?? (window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape')
  const displayModes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'].filter(
    (m) => window.matchMedia(`(display-mode: ${m})`).matches
  )
  const overflowText = (el) => {
    const s = cs(el)
    return s ? `overflow-x ${s.overflowX} / overflow-y ${s.overflowY} / overscroll-behavior-y ${s.overscrollBehaviorY}` : 'n/a'
  }
  const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect()
  const manifestDisplay = await readManifestDisplay()

  const rows = [
    ['app version', `v${APP_VERSION}`],
    ['取得時刻', new Date().toLocaleString('ja-JP')],
    ['iOS', isIOS],
    ["matchMedia('(display-mode: standalone)')", window.matchMedia('(display-mode: standalone)').matches],
    ['一致するdisplay-mode', displayModes.join(', ') || '(なし)'],
    ['navigator.standalone', navigator.standalone],
    ['--- 設定 ---', ''],
    ['meta apple-mobile-web-app-status-bar-style', meta('apple-mobile-web-app-status-bar-style')],
    ['meta apple-mobile-web-app-capable', meta('apple-mobile-web-app-capable')],
    ['meta viewport', meta('viewport')],
    ['meta theme-color', meta('theme-color')],
    ['manifest display', manifestDisplay],
    ['--- 安全領域・画面 ---', ''],
    ['env(safe-area-inset-top)', insets.top],
    ['env(safe-area-inset-bottom)', insets.bottom],
    ['screen.width', screen.width],
    ['screen.height', screen.height],
    ['window.outerHeight', window.outerHeight],
    ['window.innerWidth', window.innerWidth],
    ['window.innerHeight', window.innerHeight],
    ['documentElement.clientHeight', de.clientHeight],
    ['visualViewport.width', round(vv?.width ?? 'n/a')],
    ['visualViewport.height', round(vv?.height ?? 'n/a')],
    ['visualViewport.offsetTop', round(vv?.offsetTop ?? 'n/a')],
    ['visualViewport.offsetLeft', round(vv?.offsetLeft ?? 'n/a')],
    ['screen.height - innerHeight', screen.height - window.innerHeight],
    ['screen.height - visualViewport.height', vv ? round(screen.height - vv.height) : 'n/a'],
    ['100svh / 100dvh / 100lvh', `${unitHeight('svh')} / ${unitHeight('dvh')} / ${unitHeight('lvh')}`],
    ['fixed(top:0; bottom:0)の要素', rectText(fixedFull)],
    ['fixed(bottom:0)の要素のtop', round(fixedBottom.top)],
    ['devicePixelRatio', window.devicePixelRatio],
    ['orientation', orientation],
    ['--- 高さ・スクロール ---', ''],
    ['--app-height', cs(de).getPropertyValue('--app-height').trim() || '(未設定)'],
    ['documentElement.scrollHeight', de.scrollHeight],
    ['body.scrollHeight', body.scrollHeight],
    ['scrollingElement.scrollHeight', document.scrollingElement?.scrollHeight ?? 'n/a'],
    ['ルートのスクロール可能量(scrollHeightの大きい方 - innerHeight)', Math.max(de.scrollHeight, body.scrollHeight) - window.innerHeight],
    ['window.scrollY', round(window.scrollY)],
    ['html の高さ', round(de.getBoundingClientRect().height)],
    ['body の高さ', round(body.getBoundingClientRect().height)],
    ['#root の高さ', round(rootEl?.getBoundingClientRect().height ?? 'n/a')],
    ['.app-shell', rectText(rect('.app-shell'))],
    ['header', rectText(rect('.app-shell > header'))],
    ['下のメニューバー(nav)', rectText(rect('.app-shell > nav'))],
    ['--- CSS(計算結果) ---', ''],
    ['html', overflowText(de)],
    ['body', overflowText(body)],
    ['html.app-height-locked', de.classList.contains('app-height-locked')],
    ['--- 実験の状態 ---', ''],
    ['実験A ヘッダー上部の追加余白', `${state.headerExtra}px`],
    ['実験B ルートの縦スクロール停止', state.rootScrollOff ? 'ON' : 'OFF'],
    ['--- その他 ---', ''],
    ['userAgent', ua],
  ]
  const lines = rows.map(([k, v]) => (v === '' ? k : `${k}: ${String(v)}`))
  if (state.log.length > 0) {
    lines.push('--- 実験の前後の値 ---')
    for (const entry of state.log) {
      lines.push(`[${entry.label}]`)
      for (const key of Object.keys(entry.after)) lines.push(`  ${key}: ${entry.before[key]} → ${entry.after[key]}`)
    }
  }
  return lines.join('\n')
}
