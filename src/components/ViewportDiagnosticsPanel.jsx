import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  HEADER_EXTRA_OPTIONS,
  closeDiagnostics,
  collectDiagnostics,
  getDiagnosticsState,
  resetExperiments,
  setHeaderExtra,
  setRootScrollOff,
  subscribeDiagnostics,
} from '@/lib/viewportDiagnostics'

// 開発者向けの表示領域の診断パネル。ハンバーガーメニューのバージョン表記を5回タップしたときだけ開く。
// 画面を覆うダイアログにすると、開いている間ページのスクロールがロックされて値が変わり、
// ヘッダーのぼかしも見えなくなるため、画面の中ほどに浮かぶ小さなパネルにしている
// (上端に固定の要素を置くとiOSのステータスバーの表示に影響しうるので、上端には置かない)。
// 閉じる・画面遷移・ページを離れるときには、実験を必ず解除して元のCSSに戻す
export function ViewportDiagnosticsPanel() {
  const diag = useSyncExternalStore(subscribeDiagnostics, getDiagnosticsState)
  const location = useLocation()
  const [text, setText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [notice, setNotice] = useState('')
  const preRef = useRef(null)

  // 開いた直後(メニューのシートが閉じてスクロールのロックが外れた後)と、実験の前後で値を取り直す
  useEffect(() => {
    if (!diag.open) return
    let cancelled = false
    const timer = setTimeout(() => collectDiagnostics().then((t) => !cancelled && setText(t)), 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [diag.open, diag.log])

  // 画面遷移したら実験を解除する(パネルは開いたまま)
  const pathRef = useRef(location.pathname)
  useEffect(() => {
    if (pathRef.current === location.pathname) return
    pathRef.current = location.pathname
    resetExperiments()
  }, [location.pathname])

  // ページを離れるとき・このパネルが破棄されるときも元に戻す
  useEffect(() => {
    window.addEventListener('pagehide', resetExperiments)
    return () => {
      window.removeEventListener('pagehide', resetExperiments)
      closeDiagnostics()
    }
  }, [])

  if (!diag.open) return null
  const active = diag.headerExtra > 0 || diag.rootScrollOff

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setNotice('コピーしました')
    } catch {
      // Clipboard APIが使えない環境では、全体を選択して手動でコピーできるようにする
      const range = document.createRange()
      range.selectNodeContents(preRef.current)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      setNotice('選択しました。長押しでコピーしてください')
    }
  }

  async function handleRemeasure() {
    setText(await collectDiagnostics())
    setNotice('取り直しました')
  }

  const chip = (selected) =>
    cn(
      'min-h-8 rounded-md border px-2.5 text-xs font-bold',
      selected ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-background'
    )

  return (
    <div
      role="dialog"
      aria-label="表示領域の診断"
      className="fixed inset-x-3 top-[22%] z-[60] mx-auto max-w-md rounded-xl border bg-background/95 p-3 text-foreground shadow-xl"
    >
      <div className="flex items-center gap-2">
        <p className="flex min-w-0 flex-1 flex-col text-sm font-bold leading-tight">
          表示領域の診断
          {active && (
            <span className="whitespace-nowrap text-[11px] font-medium text-primary">
              実験中 A:+{diag.headerExtra}px B:{diag.rootScrollOff ? 'ON' : 'OFF'}
            </span>
          )}
        </p>
        {active && (
          <button type="button" onClick={resetExperiments} className="min-h-8 rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground">
            解除
          </button>
        )}
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="min-h-8 rounded-md border px-2.5 text-xs font-bold">
          {collapsed ? 'ひらく' : 'たたむ'}
        </button>
        <button type="button" onClick={closeDiagnostics} className="min-h-8 rounded-md border px-2.5 text-xs font-bold">
          閉じる
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-[11px] font-bold text-muted-foreground">実験A: ヘッダー上部の追加余白</span>
            {HEADER_EXTRA_OPTIONS.map((px) => (
              <button key={px} type="button" onClick={() => setHeaderExtra(px)} className={chip(diag.headerExtra === px)}>
                {px === 0 ? '通常(0px)' : `+${px}px`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-[11px] font-bold text-muted-foreground">
              実験B: ルートの縦スクロール停止(html・body)と1pxの要素の非表示
            </span>
            <button type="button" onClick={() => setRootScrollOff(false)} className={chip(!diag.rootScrollOff)}>
              OFF
            </button>
            <button type="button" onClick={() => setRootScrollOff(true)} className={chip(diag.rootScrollOff)}>
              ON
            </button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            「たたむ」で上部を確認。帯が残りボタンだけ下に出たのか、帯が消えたのかを見分けてください。閉じる・画面の移動・再起動で元に戻ります。
          </p>
          <pre
            ref={preRef}
            className="max-h-[24svh] select-text overflow-y-auto overscroll-contain whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed"
          >
            {text || '計測中...'}
          </pre>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleCopy} className="min-h-8 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground">
              コピー
            </button>
            <button type="button" onClick={handleRemeasure} className="min-h-8 rounded-md border px-3 text-xs font-bold">
              再測定
            </button>
            {notice && <span className="text-[11px] text-muted-foreground">{notice}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
