// スコアシートの画面表示コンポーネント(ScoreSheet.jsx)と印刷専用コンポーネント
// (ScoreSheetPrint.jsx)の両方から使う、純粋なデータ変換ロジック。
// 見た目(JSX/CSSクラス名)は両コンポーネントで完全に分離しているが、
// 「クォーターのグルーピング」「ランニングスコアの区切り判定」等の計算ロジックまで
// 重複させないよう、ここに1箇所だけ実装する。

import { formatQuarter } from '@/lib/stats'

export function formatQuarterHeader(period, periodSystem) {
  return formatQuarter(period, periodSystem)
}

// 選手名簿テーブルのファウル欄のマス数(種別コードの代わりにクォーター番号を記入)
export const FOUL_BOX_COUNT = 5

// 相手チームの選手名簿はBASKETBALL STATSで管理していないため、自チームの人数に
// 合わせた空欄の行を用意し、手書きで記入できるようにする際の最低行数
// (画面表示用ScoreSheet.jsxのみで使用)
export const MIN_BLANK_ROSTER_ROWS = 5

// 印刷用スコアシート(ScoreSheetPrint.jsx)の1ページ目のTeam A/Bの選手表は、
// 出場人数に関わらず常にこの行数で固定する(Team A/Bとも同じ行数にし、出場人数が
// 少なくてもカードの高さを縮めない。これによりA4のレイアウトが出場人数によって
// 上下に動かず、PC/モバイルどちらで出力しても1ページ目の帳票高さが一定になる)。
// 出場人数がこれを超える場合は切り捨てず、13人目以降を2ページ目に継続表示する。
export const PRINT_ROSTER_ROW_COUNT = 12

// 選手表1ページぶんの行データを作る。playersがrowCount未満の場合は残りをnull
// (空欄=手書き記入欄)で埋める。呼び出し側であらかじめ1ページぶんにslice済みの
// playersを渡す想定(2ページ目の継続表示にはrowCountを渡さず、実人数のみ表示する)。
export function buildRosterPageRows(players, rowCount) {
  const count = Math.max(players.length, rowCount)
  return Array.from({ length: count }, (_, i) => players[i] ?? null)
}

// RUNNING SCOREの1ブロックあたりの点数(1〜40, 41〜80, ...)
export const LADDER_BLOCK_SIZE = 40

// チームファウルのマス目を「1Q・2Q」「3Q・4Q」「OT」のように2区分ずつまとめる。
export function groupPeriodsForFoulGrid(lastPeriod, periodSystem) {
  const regular = periodSystem === '2q' ? 2 : 4
  const regularCount = Math.min(lastPeriod, regular)
  const rows = []
  for (let i = 1; i <= regularCount; i += 2) {
    const pair = [i]
    if (i + 1 <= regularCount) pair.push(i + 1)
    rows.push(pair)
  }
  const otPeriods = []
  for (let p = regular + 1; p <= lastPeriod; p++) otPeriods.push(p)
  if (otPeriods.length > 0) rows.push(otPeriods)
  return rows
}

// 得点イベント列の中から、各クォーターの最後のイベント・試合全体の最後のイベントを
// 求める(RUNNING SCOREのマスに太線/二重線を引く判定に使う)。
export function periodEndMap(events) {
  const lastEventIdInPeriod = new Map()
  for (const e of events) lastEventIdInPeriod.set(e.period, e.id)
  const lastEventId = events.length > 0 ? events[events.length - 1].id : null
  return { lastEventIdInPeriod, lastEventId }
}
