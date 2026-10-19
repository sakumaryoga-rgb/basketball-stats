// シューティングの参加メンバー(作成時に選んだ選手+記録画面で追加した選手)を端末に保存する。
// DBには参加メンバーを持つ列が無いため、記録(shooting_entries)がまだ無い選手は
// ここに保存しておかないと、画面を開き直したときに誰が参加者か分からなくなる
const keyOf = (sessionId) => `shootingParticipants:${sessionId}`

export function loadShootingParticipants(sessionId) {
  try {
    const value = JSON.parse(localStorage.getItem(keyOf(sessionId)) || 'null')
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

export function saveShootingParticipants(sessionId, playerIds) {
  try {
    localStorage.setItem(keyOf(sessionId), JSON.stringify(playerIds))
  } catch {
    // 保存できない環境(プライベートブラウズ等)では、記録のある選手だけが表示される
  }
}
