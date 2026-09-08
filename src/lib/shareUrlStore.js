// 共有URLの平文はDBにはハッシュしか保存されず、発行/再発行の直後しか得られない。
// ただし、このURLを実際に使って作成/参加した「この端末」は当然そのURLを知っているはずなので、
// チームIDごとにlocalStorageへ保存しておき、TEAM画面で再表示したり、退出後にチーム名だけで
// 再アクセスする際の手掛かりとして使えるようにする。
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

// 名前を渡さなかった場合、既に記録済みの名前があればそれを保持する(呼び出し側の一部は
// 名前を知らないタイミングで呼ぶため、上書きで消してしまわないようにする)
export function saveShareUrl(teamId, shareUrl, teamName) {
  if (typeof window === 'undefined' || !teamId || !shareUrl) return
  const all = readAll()
  const existing = all[teamId]
  const existingName = typeof existing === 'string' ? undefined : existing?.name
  all[teamId] = { shareUrl, name: teamName ?? existingName }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getShareUrl(teamId) {
  if (!teamId) return null
  const entry = readAll()[teamId]
  if (!entry) return null
  return typeof entry === 'string' ? entry : (entry.shareUrl ?? null)
}

// この端末がこれまでに参加/作成したことのある全チームの{teamId, shareUrl, name}一覧を返す。
// チーム名だけで再アクセスする際、この一覧から名前が一致するものを探す用途で使う。
export function getAllShareUrls() {
  const all = readAll()
  return Object.entries(all).map(([teamId, entry]) =>
    typeof entry === 'string' ? { teamId, shareUrl: entry, name: undefined } : { teamId, shareUrl: entry.shareUrl, name: entry.name }
  )
}
