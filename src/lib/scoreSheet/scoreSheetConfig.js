// スコアシート機能の対象チームを制御するfeature flag。
// DB変更(feature flag用カラム追加等)は行わず、既存のVITE_*環境変数の慣習
// (src/supabaseClient.js, ContactForm.jsxのVITE_TURNSTILE_SITE_KEY)に合わせ、
// カンマ区切りのteam_id一覧を環境変数で渡す方式にする。
//
// team.name === 'Tokyo Comets' のような名前ハードコードは避ける(チーム名は
// ユーザーがいつでも変更できるため)。team_idで判定する。
//
// Vercelの環境変数(Production/Preview)にVITE_SCORE_SHEET_TEST_TEAM_IDSが
// 未設定の場合、この機能は全チームで非表示のまま(安全側のデフォルト)。
const RAW_TEAM_IDS = import.meta.env.VITE_SCORE_SHEET_TEST_TEAM_IDS || ''

const ENABLED_TEAM_IDS = new Set(
  RAW_TEAM_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
)

export function isScoreSheetEnabledForTeam(teamId) {
  if (!teamId) return false
  return ENABLED_TEAM_IDS.has(teamId)
}
