import { supabase } from '@/supabaseClient'

// 選手の写真を Storage にアップロードし、公開URLを返す
export async function uploadPlayerPhoto(playerId, file) {
  const ext = file.name.split('.').pop()
  const path = `${playerId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('player-photos').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path)
  return data.publicUrl
}

// 選手の写真を Storage から削除する(ベストエフォート。失敗してもUIは進める)
export async function deletePlayerPhoto(photoUrl) {
  if (!photoUrl) return
  const path = photoUrl.split('/player-photos/')[1]
  if (!path) return
  const { error } = await supabase.storage.from('player-photos').remove([path])
  if (error) console.error('写真の削除に失敗しました', error)
}

// 調整・圧縮済みのアイコン画像(JPEGのBlob)をアップロードし、公開URLを返す。
// folderは選手ID。追加時はまだ選手IDが無いので、仮のIDのフォルダに置く
export async function uploadPlayerPhotoBlob(folder, blob) {
  const path = `${folder}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('player-photos').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('player-photos').getPublicUrl(path)
  return data.publicUrl
}

// PlayerPhotoFieldの値を保存する。戻り値は保存するphoto_url(変更が無ければundefined)。
// 置き換え・削除した古い画像は、既存の編集画面と同じくベストエフォートでStorageから消す
export async function applyPlayerPhotoChange({ folder, photo, currentUrl }) {
  if (photo?.blob) {
    const url = await uploadPlayerPhotoBlob(folder, photo.blob)
    if (currentUrl) await deletePlayerPhoto(currentUrl)
    return url
  }
  if (photo?.removed) {
    if (currentUrl) await deletePlayerPhoto(currentUrl)
    return null
  }
  return undefined
}
