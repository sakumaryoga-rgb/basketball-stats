// ゲスト選手 = players.guest_game_id が設定された行(supabase/migrations/006_guest_players.sql)。
// その試合だけ参加する一時的なメンバーで、チームの恒久的なロスターではない。
// usePlayers(teamId)はチームの全試合分のゲストも含めて返すため、画面ごとに
// 「チームの選手」と「その試合の参加者」を必ずこのどちらかで切り分けて使う
export function isGuest(player) {
  return !!player?.guest_game_id
}

// チームの恒久的なロスター(ゲストを含まない)。PLAYERS・LEADERS・TEAM・シューティングの
// 選手選択・新しい試合の初期ロスターなど、試合をまたぐ画面はすべてこちら
export function teamRoster(players) {
  return players.filter((p) => !isGuest(p))
}

// その試合の参加者 = チームのロスター + その試合限定のゲスト(他の試合のゲストは含めない)
export function gameParticipants(players, gameId) {
  return players.filter((p) => !isGuest(p) || p.guest_game_id === gameId)
}
