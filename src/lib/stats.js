// ライブ入力画面のスタッツカテゴリ(カテゴリを選び、対応する結果ボタンをタップして記録する)
export const STAT_CATEGORIES = [
  { key: 'fg2', label: '2ポイント', kind: 'shot', make: 'fg2_make', miss: 'fg2_miss' },
  { key: 'fg3', label: '3ポイント', kind: 'shot', make: 'fg3_make', miss: 'fg3_miss' },
  { key: 'ft', label: 'フリースロー', kind: 'ft', make: 'ft_make', miss: 'ft_miss' },
  {
    key: 'reb',
    label: 'リバウンド',
    kind: 'pair',
    left: { key: 'oreb', label: 'オフェンス' },
    right: { key: 'dreb', label: 'ディフェンス' },
  },
  { key: 'ast', label: 'アシスト', kind: 'single', stat: 'ast' },
  { key: 'stl', label: 'スティール', kind: 'single', stat: 'stl' },
  { key: 'blk', label: 'ブロック', kind: 'single', stat: 'blk' },
  { key: 'tov', label: 'ターンオーバー', kind: 'single', stat: 'tov' },
  { key: 'pf', label: 'ファウル', kind: 'single', stat: 'pf' },
]

export const STAT_KEY_LABEL = {
  fg2_make: '2P成功', fg2_miss: '2P失敗',
  fg3_make: '3P成功', fg3_miss: '3P失敗',
  ft_make: 'FT成功', ft_miss: 'FT失敗',
  oreb: 'OREB', dreb: 'DREB',
  ast: 'AST', stl: 'STL', blk: 'BLK', tov: 'TO', pf: 'PF',
}

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

export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatQuarter(quarter) {
  return quarter <= 4 ? `${quarter}Q` : `OT${quarter - 4}`
}
