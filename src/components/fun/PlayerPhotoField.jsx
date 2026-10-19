import { useEffect, useRef, useState } from 'react'
import { Crop, ImagePlus, Trash2 } from 'lucide-react'
import { Jersey } from '@/components/fun/Jersey'
import { AvatarCropDialog } from '@/components/fun/AvatarCropDialog'
import { AvatarImageError, validateImageFile } from '@/lib/avatarImage'

// 選手のプロフィール画像の選択欄(選手の追加・編集で共通)。
// value: { displayUrl, blob, removed }
//  - displayUrl: いま表示する画像(保存済みのphoto_url、または調整後のプレビュー)
//  - blob: 調整して新しく保存する画像(未変更ならnull)
//  - removed: 保存済みの画像を削除する
// 保存は親が applyPlayerPhotoChange(uploadPlayerPhoto.js)で行う
export function PlayerPhotoField({ value, onChange, number, color }) {
  const inputRef = useRef(null)
  const [cropSource, setCropSource] = useState(null)
  // 調整ダイアログを開くたびに作り直すための番号(前回の位置・倍率を引き継がない)
  const [cropKey, setCropKey] = useState(0)
  function openCrop(source) {
    setCropKey((k) => k + 1)
    setCropSource(source)
  }
  const [error, setError] = useState('')
  // 新しく選んだ元画像。「位置を調整」で、切り抜き済みではなく元の解像度から調整し直すために持っておく
  const originalRef = useRef(null)
  useEffect(() => () => originalRef.current && URL.revokeObjectURL(originalRef.current), [])

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      validateImageFile(file)
    } catch (err) {
      setError(err instanceof AvatarImageError ? err.message : '画像を読み込めませんでした')
      return
    }
    setError('')
    if (originalRef.current) URL.revokeObjectURL(originalRef.current)
    originalRef.current = URL.createObjectURL(file)
    openCrop({ src: originalRef.current, crossOrigin: false })
  }

  function handleReadjust() {
    // 新しく選んだ画像があればその元画像から、保存済みの画像なら保存済みのものから調整し直す
    if (originalRef.current) openCrop({ src: originalRef.current, crossOrigin: false })
    else if (value.displayUrl) openCrop({ src: value.displayUrl, crossOrigin: true })
  }

  function handleRemove() {
    if (originalRef.current) URL.revokeObjectURL(originalRef.current)
    originalRef.current = null
    setError('')
    onChange({ displayUrl: null, blob: null, removed: true })
  }

  const hasImage = !!value.displayUrl

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={hasImage ? '画像を変更' : '画像を選択'}
        className="press relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-4 ring-background shadow-md"
      >
        {hasImage ? (
          <img src={value.displayUrl} alt="" className="size-full object-cover" />
        ) : (
          <Jersey number={number === '' ? null : number} color={color} className="size-16" />
        )}
        {!hasImage && (
          <span className="absolute bottom-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground ring-2 ring-background">
            <ImagePlus className="size-3.5" />
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-bold text-muted-foreground">アイコン画像(任意)</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="press flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-bold hover:bg-muted"
          >
            <ImagePlus className="size-3.5" />
            {hasImage ? '画像を変更' : '画像を選択'}
          </button>
          {hasImage && (
            <>
              <button
                type="button"
                onClick={handleReadjust}
                className="press flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs font-bold hover:bg-muted"
              >
                <Crop className="size-3.5" />
                位置を調整
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="press flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                画像を削除
              </button>
            </>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <AvatarCropDialog
        key={cropKey}
        open={!!cropSource}
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onDone={(blob, previewUrl) => {
          setCropSource(null)
          onChange({ displayUrl: previewUrl, blob, removed: false })
        }}
      />
    </div>
  )
}
