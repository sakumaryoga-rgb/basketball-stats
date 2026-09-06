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
