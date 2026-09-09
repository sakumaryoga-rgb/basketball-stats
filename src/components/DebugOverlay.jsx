import { useEffect, useRef, useState } from 'react'

// フッター浮き問題の原因を推測ベースで直し続けても解消しなかったため、実機の生の値を
// 直接確認するための一時的な診断表示。原因が特定でき次第、このファイルとLayout.jsxでの
// 呼び出しを削除する
export function DebugOverlay() {
  const [info, setInfo] = useState(null)
  const safeTopRef = useRef(null)
  const safeBottomRef = useRef(null)

  useEffect(() => {
    function update() {
      const nav = document.querySelector('nav')
      const shell = nav?.parentElement
      setInfo({
        innerH: window.innerHeight,
        vvH: window.visualViewport?.height ?? null,
        vvOffsetTop: window.visualViewport?.offsetTop ?? null,
        screenH: window.screen?.height ?? null,
        dpr: window.devicePixelRatio,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        navStandalone: window.navigator.standalone ?? null,
        appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
        safeTop: safeTopRef.current ? getComputedStyle(safeTopRef.current).paddingTop : null,
        safeBottom: safeBottomRef.current ? getComputedStyle(safeBottomRef.current).paddingBottom : null,
        navBottom: nav ? nav.getBoundingClientRect().bottom : null,
        shellHeight: shell ? shell.getBoundingClientRect().height : null,
        docHeight: document.documentElement.getBoundingClientRect().height,
      })
    }
    update()
    const id = setInterval(update, 500)
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return (
    <>
      <div ref={safeTopRef} style={{ position: 'fixed', top: 0, paddingTop: 'env(safe-area-inset-top)', pointerEvents: 'none', opacity: 0 }} />
      <div ref={safeBottomRef} style={{ position: 'fixed', bottom: 0, paddingBottom: 'env(safe-area-inset-bottom)', pointerEvents: 'none', opacity: 0 }} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          color: '#0f0',
          fontSize: '9px',
          fontFamily: 'monospace',
          padding: '4px',
          lineHeight: 1.3,
          pointerEvents: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {info ? JSON.stringify(info, null, 0) : 'loading...'}
      </div>
    </>
  )
}
