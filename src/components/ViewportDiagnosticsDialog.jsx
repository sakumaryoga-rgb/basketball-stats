import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { APP_VERSION } from '@/lib/appVersion'

// 開発者向けの診断画面(iOSのホーム画面アプリで上部のぼかしがヘッダーに重なる問題の調査用)。
// ハンバーガーメニューのバージョン表記を5回タップしたときだけ開く。
// 値を読み取って表示するだけで、高さの計算・スクロール・レイアウトには一切触れない

// env(safe-area-inset-*)の実際の値を、診断用の一時的な非表示要素に付けて読み取る
function readSafeAreaInsets() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = { top: style.paddingTop, bottom: style.paddingBottom }
  probe.remove()
  return insets
}

function collectDiagnostics() {
  const ua = navigator.userAgent
  const isIOS = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const vv = window.visualViewport
  const insets = readSafeAreaInsets()
  const round = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : String(n))
  const diff = (a, b) => (typeof a === 'number' && typeof b === 'number' ? round(a - b) : 'n/a')
  const orientation =
    screen.orientation?.type ?? (window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape')
  return [
    ['app version', `v${APP_VERSION}`],
    ['iOS', String(isIOS)],
    ["matchMedia('(display-mode: standalone)')", String(window.matchMedia('(display-mode: standalone)').matches)],
    ['navigator.standalone', String(navigator.standalone)],
    ['env(safe-area-inset-top)', insets.top],
    ['env(safe-area-inset-bottom)', insets.bottom],
    ['screen.width', round(screen.width)],
    ['screen.height', round(screen.height)],
    ['window.innerWidth', round(window.innerWidth)],
    ['window.innerHeight', round(window.innerHeight)],
    ['documentElement.clientHeight', round(document.documentElement.clientHeight)],
    ['visualViewport.width', round(vv?.width ?? 'n/a')],
    ['visualViewport.height', round(vv?.height ?? 'n/a')],
    ['visualViewport.offsetTop', round(vv?.offsetTop ?? 'n/a')],
    ['visualViewport.offsetLeft', round(vv?.offsetLeft ?? 'n/a')],
    ['screen.height - innerHeight', diff(screen.height, window.innerHeight)],
    ['screen.height - visualViewport.height', diff(screen.height, vv?.height)],
    ['devicePixelRatio', round(window.devicePixelRatio)],
    ['orientation', orientation],
    ['--app-height', getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim() || '(未設定)'],
    ['window.scrollY', round(window.scrollY)],
    ['userAgent', ua],
  ]
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

// 開いている間だけ描画する(開くたびに作り直し、その時点の値を取得する)
export function ViewportDiagnosticsDialog({ onClose }) {
  const [text, setText] = useState(collectDiagnostics)
  const [copied, setCopied] = useState('')
  const preRef = useRef(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied('コピーしました')
    } catch {
      // Clipboard APIが使えない環境では、全体を選択して手動でコピーできるようにする
      const range = document.createRange()
      range.selectNodeContents(preRef.current)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      setCopied('選択しました。長押しでコピーしてください')
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="text-base">表示領域の診断</DialogTitle>
        <DialogDescription className="text-xs">開発者向けの情報です。値を読み取って表示するだけです。</DialogDescription>
        <pre
          ref={preRef}
          className="select-text whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-[11px] leading-relaxed"
        >
          {text}
        </pre>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleCopy}>
            コピー
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setText(collectDiagnostics())}>
            再取得
          </Button>
          {copied && <span className="text-xs text-muted-foreground">{copied}</span>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
