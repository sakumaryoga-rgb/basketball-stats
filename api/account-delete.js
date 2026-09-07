// 匿名アカウントの自己削除エンドポイント。
//
// 削除対象は「auth.uid()に直接紐づく本人専用のデータ」のみとし、players/games/stat_events等の
// チーム共有データ(匿名アカウント本人だけの所有物とは限らない)は一切削除しない。
//   - team_membersの本人行(全チーム分)
//   - 本人に紐づく技術的なレート制限ログ(contact_submissions)
//   - 本人所有のStorageオブジェクト(現状は存在しないため実質no-op。将来追加時はここに処理を足す)
//   - Supabase auth.usersの匿名アカウント本体
// user_consents(同意記録)は法的・運用上の証跡として行ごと保持しつつ、本人特定情報である
// user_idのみをNULLにして非識別化する(同意バージョン・日時という履歴自体は消さない)。
//
// このアプリは共有URL方式(チームごとの共有URLを知っている端末が読み書きできる)のため、
// team_membersに役割の区別はなく、削除に際して他メンバーへの移譲等は不要。
//
// SUPABASE_SERVICE_ROLE_KEYはこのVercel Function内でのみ使用し、クライアントには一切渡さない。

import { supabaseRequest } from './_lib/contact-shared.js'

async function verifySupabaseUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) return null
  const data = await response.json()
  return data?.id || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const userId = await verifySupabaseUser(req.headers['authorization'])
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  try {
    // team_membersの本人行(全チーム分)を削除。games/stat_events/players等のチーム共有データは対象外。
    await supabaseRequest(`/rest/v1/team_members?user_id=eq.${userId}`, { method: 'DELETE' })

    // 本人に紐づく技術的なレート制限ログを削除
    await supabaseRequest(`/rest/v1/contact_submissions?user_id=eq.${userId}`, { method: 'DELETE' })

    // 本人所有のStorageオブジェクトは現状存在しない(icon_urlはチーム共有データのため対象外)。No-op。

    // user_consentsは削除せず、本人特定情報(user_id)のみ非識別化する
    await supabaseRequest(`/rest/v1/user_consents?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: { user_id: null },
    })

    // 最後に、Supabase Auth上の匿名アカウント本体を削除する(取り消し不可のため必ず最後に行う)
    const deleteAuthResponse = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!deleteAuthResponse.ok) {
      throw new Error(`Supabase Admin API error: ${deleteAuthResponse.status} ${await deleteAuthResponse.text()}`)
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('アカウント削除処理に失敗しました', err)
    res.status(500).json({ error: 'internal error' })
  }
}
