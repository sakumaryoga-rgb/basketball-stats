// 実験的な機能をTokyo Comets(検証チーム)限定で先行公開するためのfeature flag。
// DB変更(feature flag用カラム追加等)は行わず、既存のVITE_*環境変数の慣習
// (src/supabaseClient.js, ContactForm.jsxのVITE_TURNSTILE_SITE_KEY)に合わせ、
// カンマ区切りのteam_id一覧を環境変数で渡す方式にする。
//
// team.name === 'Tokyo Comets' のような名前ハードコードは避ける(チーム名は
// ユーザーがいつでも変更できるため)。team_idで判定する。
//
// 元々スコアシート機能専用だったが、ライブ記録画面(タイマー等)の先行検証にも
// 同じ仕組みを使い回すため、判定関数はスコアシートに限定しない汎用名にしている。
//
// 環境変数は汎用名VITE_TEST_TEAM_IDSを正とし、未設定の場合のみ旧名
// VITE_SCORE_SHEET_TEST_TEAM_IDS(スコアシート機能導入時に設定したもの)へ
// フォールバックする。これにより、Vercel側の環境変数を今すぐ追加/変更しなくても
// 現状のまま動作し続ける(将来的にVITE_TEST_TEAM_IDSへ設定を追加・移行しても、
// 旧名をそのまま残しておいても、どちらでも壊れない)。
//
// Vercelの環境変数(Production/Preview)にどちらも未設定の場合、対象の機能は
// 全チームで無効のまま(安全側のデフォルト)。
const RAW_TEAM_IDS = import.meta.env.VITE_TEST_TEAM_IDS || import.meta.env.VITE_SCORE_SHEET_TEST_TEAM_IDS || ''

const TEST_TEAM_IDS = new Set(
  RAW_TEAM_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
)

export function isTeamInTestGroup(teamId) {
  if (!teamId) return false
  return TEST_TEAM_IDS.has(teamId)
}
