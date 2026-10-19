import { useMemo, useState } from 'react'
import { MAX_STARTERS, initialLineup, starterCount } from '@/lib/lineupDraft'
import { DRAFT_GUEST_PREFIX } from '@/lib/gameSetup'

// 試合/スクリメージ作成画面の下書き(STARTING FIVE / RESERVEと、この試合だけのゲスト)。
// roster: チームの恒久的なロスター(teamRosterで絞り込んだもの)
export function useGameSetupDraft(roster) {
  // nullの間は(選手の読み込み後も)DBトリガーと同じ初期状態を表示する
  const [lineupDraft, setLineupDraft] = useState(null)
  const [draftGuests, setDraftGuests] = useState([])
  const lineup = lineupDraft ?? initialLineup(roster)

  // LineupEditorに渡す選手一覧。下書きのゲストはguest_game_idに仮の値を入れてゲストとして表示する
  const editorPlayers = useMemo(
    () => [...roster, ...draftGuests.map((g) => ({ id: g.id, name: g.name, number: g.number, position: null, guest_game_id: 'draft' }))],
    [roster, draftGuests]
  )

  // STARTING FIVEは5人そろえてから作成する(選手が5人未満のチームは全員)
  const requiredStarters = Math.min(MAX_STARTERS, editorPlayers.length)
  const startersError =
    starterCount(lineup) < requiredStarters
      ? `STARTING FIVEを${requiredStarters}人選んでください(現在${starterCount(lineup)}人)`
      : ''

  function addGuest({ name, number }) {
    const id = `${DRAFT_GUEST_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    setDraftGuests((prev) => [...prev, { id, name, number }])
    // 追加したゲストはまずRESERVEへ(STARTING FIVEの5人ルールを崩さないため)
    setLineupDraft((prev) => {
      const base = prev ?? initialLineup(roster)
      return { ...base, reserves: [...base.reserves, id] }
    })
  }

  function removeGuest(id) {
    setDraftGuests((prev) => prev.filter((g) => g.id !== id))
    setLineupDraft((prev) => {
      const base = prev ?? initialLineup(roster)
      // 先発の枠にいたゲストを消した場合、その枠は空き(null)にする
      return { starters: base.starters.map((x) => (x === id ? null : x)), reserves: base.reserves.filter((x) => x !== id) }
    })
  }

  function reset() {
    setLineupDraft(null)
    setDraftGuests([])
  }

  return { lineup, setLineupDraft, draftGuests, editorPlayers, startersError, addGuest, removeGuest, reset }
}
