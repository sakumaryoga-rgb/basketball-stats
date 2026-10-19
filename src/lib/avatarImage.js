// 選手アイコン用の画像処理(ブラウザ標準のCanvasのみ。追加ライブラリなし)

// アイコンとして保存する画像の一辺(px)。表示は最大でも100px程度だが、高解像度画面でも
// 荒くならないよう余裕を持たせる。JPEG品質0.88で、多くの写真は数十KBに収まる
export const AVATAR_OUTPUT_SIZE = 512
const AVATAR_JPEG_QUALITY = 0.88
// これより大きいファイルは読み込まない(スマホの高解像度写真でも通常は10MB前後)
export const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024

export class AvatarImageError extends Error {}

// 画像ファイル(またはURL)を読み込み、HTMLImageElementを返す
export function loadImage(src, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) reject(new AvatarImageError('画像を読み込めませんでした'))
      else resolve(img)
    }
    img.onerror = () => reject(new AvatarImageError('画像として読み込めないファイルです。JPEG・PNGなどの画像を選んでください'))
    img.src = src
  })
}

export function validateImageFile(file) {
  if (!file) throw new AvatarImageError('ファイルが選択されていません')
  if (file.type && !file.type.startsWith('image/')) {
    throw new AvatarImageError('画像ファイルを選んでください')
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new AvatarImageError(`ファイルが大きすぎます(${Math.round(MAX_SOURCE_FILE_BYTES / 1024 / 1024)}MBまで)`)
  }
}

// 調整画面の正方形の表示枠(viewportSize px)に、画像を scale 倍・中心からのずれ (x, y) で
// 置いたときに、枠に見えている範囲を AVATAR_OUTPUT_SIZE の正方形JPEGとして切り出す。
// 丸いアイコンは正方形の内接円なので、調整画面の円の中と保存後の表示は一致する
export function cropToAvatarBlob(img, { viewportSize, scale, x, y }) {
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_OUTPUT_SIZE
  canvas.height = AVATAR_OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // 透過PNGの背景が黒くならないよう白で塗っておく
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE)
  const ratio = AVATAR_OUTPUT_SIZE / viewportSize
  const drawW = img.naturalWidth * scale * ratio
  const drawH = img.naturalHeight * scale * ratio
  const left = (viewportSize / 2 + x) * ratio - drawW / 2
  const top = (viewportSize / 2 + y) * ratio - drawH / 2
  ctx.drawImage(img, left, top, drawW, drawH)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new AvatarImageError('画像の変換に失敗しました'))),
      'image/jpeg',
      AVATAR_JPEG_QUALITY
    )
  })
}

// 画像が枠全体(=円)を常に覆うための最小倍率
export function coverScale(img, viewportSize) {
  return Math.max(viewportSize / img.naturalWidth, viewportSize / img.naturalHeight)
}

// 円の外に余白が出ないよう、ずれ(x, y)を画像の端までに制限する
export function clampOffset(img, viewportSize, scale, x, y) {
  const maxX = Math.max(0, (img.naturalWidth * scale - viewportSize) / 2)
  const maxY = Math.max(0, (img.naturalHeight * scale - viewportSize) / 2)
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
}
