import { supabase } from '@/supabaseClient'

// チームのアイコン画像を Storage にアップロードし、公開URLを返す
export async function uploadTeamIcon(teamId, file) {
  const ext = file.name.split('.').pop()
  const path = `${teamId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('team-icons').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from('team-icons').getPublicUrl(path)
  return data.publicUrl
}
