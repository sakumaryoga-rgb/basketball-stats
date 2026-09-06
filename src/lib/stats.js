// スタッツ入力ボタンの定義(ライブ入力画面で表示する順番)
export const STAT_BUTTONS = [
  { key: 'fg2_make', label: '2P成功', group: 'shot' },
  { key: 'fg2_miss', label: '2P失敗', group: 'shot' },
  { key: 'fg3_make', label: '3P成功', group: 'shot' },
  { key: 'fg3_miss', label: '3P失敗', group: 'shot' },
  { key: 'ft_make', label: 'FT成功', group: 'shot' },
  { key: 'ft_miss', label: 'FT失敗', group: 'shot' },
  { key: 'oreb', label: 'OREB', group: 'other' },
  { key: 'dreb', label: 'DREB', group: 'other' },
  { key: 'ast', label: 'AST', group: 'other' },
  { key: 'stl', label: 'STL', group: 'other' },
  { key: 'blk', label: 'BLK', group: 'other' },
  { key: 'tov', label: 'TO', group: 'other' },
  { key: 'pf', label: 'PF', group: 'other' },
]

// ボックススコア / 個人ページの表で使う集計スタッツの並び
export const BOX_SCORE_COLUMNS = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TO' },
  { key: 'pf', label: 'PF' },
  { key: 'fgm_fga', label: 'FG' },
  { key: 'tpm_tpa', label: '3P' },
  { key: 'ftm_fta', label: 'FT' },
]

// NBA公式のスタッツリーダーページを模した項目一覧
// avg: 1試合平均を見る項目 / pct: 割合(%)を見る項目
export const LEADER_CATEGORIES = [
  { key: 'pts', label: '得点', type: 'avg' },
  { key: 'reb', label: 'リバウンド', type: 'avg' },
  { key: 'ast', label: 'アシスト', type: 'avg' },
  { key: 'stl', label: 'スティール', type: 'avg' },
  { key: 'blk', label: 'ブロック', type: 'avg' },
  { key: 'fg_pct', label: 'FG%', type: 'pct', made: 'fgm', att: 'fga' },
  { key: 'tp_pct', label: '3P%', type: 'pct', made: 'tpm', att: 'tpa' },
  { key: 'ft_pct', label: 'FT%', type: 'pct', made: 'ftm', att: 'fta' },
]

export function pct(made, att) {
  if (!att) return null
  return (made / att) * 100
}

export function formatPct(value) {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

export function formatAvg(value) {
  if (value === null || value === undefined) return '-'
  return value.toFixed(1)
}

export function perGame(total, games) {
  if (!games) return null
  return total / games
}
