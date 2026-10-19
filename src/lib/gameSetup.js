import { applyStartingLineup } from '@/hooks/useGameLineups'
import { initialLineup, sameStarters, starterIds } from '@/lib/lineupDraft'

// 作成画面で追加したゲストの仮ID。試合を作るまではDBに行が無いので、画面内だけで使う
export const DRAFT_GUEST_PREFIX = 'draft-guest-'

export function isDraftGuestId(id) {
  return typeof id === 'string' && id.startsWith(DRAFT_GUEST_PREFIX)
}

// 試合(またはスクリメージ)を作成した直後の後処理。
// 1. 作成画面で追加したゲストを、試合画面の「ゲストを追加」と同じ形(players.guest_game_id=この試合)で登録する
// 2. STARTING FIVEを初期状態(PLAYERSタブの設定)から変えた場合、またはゲストを先発に入れた場合だけ
//    game_lineupsに反映する
// 試合自体は作成済みなので、途中で失敗しても例外にはせず、画面に出す注意文を返す
export async function finishGameSetup({ gameId, roster, lineup, draftGuests, addPlayer }) {
  const idMap = new Map()
  const failedGuests = []
  for (const guest of draftGuests) {
    try {
      const created = await addPlayer({ name: guest.name, number: guest.number, guestGameId: gameId })
      idMap.set(guest.id, created.id)
    } catch (err) {
      console.error('ゲストの追加に失敗しました', err)
      failedGuests.push(guest.name)
    }
  }
  const starters = starterIds(lineup).map((id) => (isDraftGuestId(id) ? idMap.get(id) : id)).filter(Boolean)
  const guestStarter = starterIds(lineup).some(isDraftGuestId)
  const warnings = []
  if (failedGuests.length > 0) warnings.push(`ゲスト(${failedGuests.join('、')})を追加できませんでした。試合画面の「ゲストを追加」から追加してください`)
  if (guestStarter || !sameStarters(lineup, initialLineup(roster))) {
    try {
      await applyStartingLineup(gameId, starters)
    } catch (err) {
      console.error('STARTING FIVEの反映に失敗しました', err)
      warnings.push('STARTING FIVEを反映できませんでした。試合画面の選手交代で設定してください')
    }
  }
  return warnings.join(' ')
}
