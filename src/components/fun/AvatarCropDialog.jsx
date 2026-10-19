import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AvatarImageError, clampOffset, coverScale, cropToAvatarBlob, loadImage } from '@/lib/avatarImage'

const MAX_ZOOM = 4 // 枠を覆う最小倍率に対して最大4倍まで

// LINEのプロフィール画像設定のような、丸枠に合わせて写真の位置・大きさを調整するダイアログ。
// - 正方形の枠の内接円が実際のアイコンの範囲。円の外側は暗くして切り取られる部分を示す
// - 1本指(マウス)のドラッグで移動、2本指のピンチ・スライダー・ホイールで拡大縮小
// - 枠の中ではtouch-action:noneにして、ページのスクロールやブラウザのズームに操作を取られないようにする
// source: { src, crossOrigin } / onDone(blob, previewUrl)
export function AvatarCropDialog({ open, source, onCancel, onDone }) {
  const [img, setImg] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  // 開くたびに作り直す(親がkeyを変える)ので、初期値は表示時の画面幅から決める
  const [viewportSize] = useState(() => Math.max(220, Math.min(320, window.innerWidth - 72)))
  const frameRef = useRef(null)
  const pointersRef = useRef(new Map())
  const gestureRef = useRef(null)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  })

  // 画像を読み込み、枠いっぱい(中央)から始める
  useEffect(() => {
    if (!open || !source) return
    let cancelled = false
    loadImage(source.src, { crossOrigin: source.crossOrigin })
      .then((loaded) => !cancelled && setImg(loaded))
      .catch((err) => !cancelled && setError(err instanceof AvatarImageError ? err.message : '画像を読み込めませんでした'))
    return () => {
      cancelled = true
    }
  }, [open, source])

  // iOS Safariのピンチは独自のgestureイベントでページ全体を拡大しようとするので止める
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const stop = (e) => e.preventDefault()
    frame.addEventListener('gesturestart', stop)
    frame.addEventListener('gesturechange', stop)
    frame.addEventListener('touchmove', stop, { passive: false })
    return () => {
      frame.removeEventListener('gesturestart', stop)
      frame.removeEventListener('gesturechange', stop)
      frame.removeEventListener('touchmove', stop)
    }
  })

  const baseScale = img ? coverScale(img, viewportSize) : 1

  function apply(next) {
    if (!img) return
    const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom))
    const { x, y } = clampOffset(img, viewportSize, baseScale * zoom, next.x, next.y)
    setView({ zoom, x, y })
  }

  // 枠の中心を基準に拡大縮小(ピンチは指の中点を基準にする)
  function zoomAround(nextZoom, anchorX = 0, anchorY = 0, from = viewRef.current) {
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
    const k = z / from.zoom
    apply({ zoom: z, x: anchorX - (anchorX - from.x) * k, y: anchorY - (anchorY - from.y) * k })
  }

  function localPoint(e) {
    const rect = frameRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 }
  }

  function startGesture() {
    const pts = [...pointersRef.current.values()]
    const v = viewRef.current
    if (pts.length === 1) gestureRef.current = { type: 'pan', start: pts[0], view: v }
    else if (pts.length >= 2) {
      const [a, b] = pts
      gestureRef.current = {
        type: 'pinch',
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: v,
      }
    }
  }

  function handlePointerDown(e) {
    if (!img) return
    e.preventDefault()
    frameRef.current.setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, localPoint(e))
    startGesture()
  }

  function handlePointerMove(e) {
    if (!pointersRef.current.has(e.pointerId) || !gestureRef.current) return
    pointersRef.current.set(e.pointerId, localPoint(e))
    const g = gestureRef.current
    const pts = [...pointersRef.current.values()]
    if (g.type === 'pan' && pts.length === 1) {
      apply({ zoom: g.view.zoom, x: g.view.x + (pts[0].x - g.start.x), y: g.view.y + (pts[0].y - g.start.y) })
    } else if (g.type === 'pinch' && pts.length >= 2) {
      const [a, b] = pts
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const z = Math.min(MAX_ZOOM, Math.max(1, (g.view.zoom * dist) / g.dist))
      const k = z / g.view.zoom
      // ピンチの中点を基準に拡大しつつ、中点の移動ぶんだけ画像も動かす
      apply({ zoom: z, x: mid.x - (g.mid.x - g.view.x) * k, y: mid.y - (g.mid.y - g.view.y) * k })
    }
  }

  function handlePointerUp(e) {
    pointersRef.current.delete(e.pointerId)
    // 指が1本残ったら、そこからの移動として続ける
    if (pointersRef.current.size > 0) startGesture()
    else gestureRef.current = null
  }

  function handleWheel(e) {
    if (!img) return
    const p = localPoint(e)
    zoomAround(viewRef.current.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), p.x, p.y)
  }

  async function handleDone() {
    if (!img) return
    setSaving(true)
    try {
      const blob = await cropToAvatarBlob(img, { viewportSize, scale: baseScale * view.zoom, x: view.x, y: view.y })
      onDone(blob, URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof AvatarImageError ? err.message : '画像を保存できる形に変換できませんでした')
    } finally {
      setSaving(false)
    }
  }

  const scale = baseScale * view.zoom
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex flex-col items-center gap-4 overflow-hidden bg-secondary text-secondary-foreground sm:max-w-sm" showCloseButton={false}>
        <div className="w-full text-center">
          <DialogTitle className="font-heading text-xl tracking-wide text-secondary-foreground">位置と大きさを調整</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/70">
            ドラッグで移動、ピンチまたは下のスライダーで拡大・縮小。丸の中がアイコンになります
          </DialogDescription>
        </div>

        <div
          ref={frameRef}
          className="relative shrink-0 select-none overflow-hidden rounded-2xl bg-black [touch-action:none]"
          style={{ width: viewportSize, height: viewportSize, cursor: img ? 'grab' : 'default' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: img.naturalWidth * scale,
                height: img.naturalHeight * scale,
                transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
              }}
            />
          )}
          {/* 円の外側を暗くして、保存される範囲(円の中)を示す */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90"
            style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
          />
          {!img && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white/70">読み込み中...</div>
          )}
          {error && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</div>}
        </div>

        <div className="flex w-full items-center gap-3 px-2">
          <button
            type="button"
            aria-label="縮小"
            onClick={() => zoomAround(view.zoom / 1.2)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomAround(Number(e.target.value))}
            aria-label="拡大率"
            disabled={!img}
            className="h-2 w-full cursor-pointer accent-[var(--chart-3)]"
          />
          <button
            type="button"
            aria-label="拡大"
            onClick={() => zoomAround(view.zoom * 1.2)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10"
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="grid w-full grid-cols-2 gap-2">
          <Button type="button" variant="ghost" className="h-11 rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" className="h-11 rounded-xl font-bold" disabled={!img || saving} onClick={handleDone}>
            {saving ? '処理中...' : 'この範囲で使う'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
