// 共有URLの平文はDBにはハッシュしか保存されず、発行/再発行の直後しか得られない。
// ただし、このURLを実際に使って作成/参加した「この端末」は当然そのURLを知っているはずなので、
// チームIDごとにlocalStorageへ保存しておき、TEAM画面で再表示できるようにする。
// (サーバー側に平文を保存する設計には戻さない。あくまでこの端末のためのローカルなメモ)
const STORAGE_KEY = 'shareUrlsByTeamId'

function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export function saveShareUrl(teamId, shareUrl) {
  if (typeof window === 'undefined' || !teamId || !shareUrl) return
  const all = readAll()
  all[teamId] = shareUrl
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getShareUrl(teamId) {
  if (!teamId) return null
  return readAll()[teamId] ?? null
}
