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

// プラスマイナス(±)。プラスの値には符号を付けて表示する
export function formatPlusMinus(value) {
  if (value === null || value === undefined) return '-'
  return value > 0 ? `+${value}` : `${value}`
}

// ポジションの選択肢と表示順(PG, SG, SF, PF, C)
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

// ROSTERの並び替えで使う、第一ポジションの表示順インデックス(未設定は最後)
export function positionSortIndex(position) {
  const index = POSITIONS.indexOf(position)
  return index === -1 ? POSITIONS.length : index
}

// ポジション未設定の選手をまとめるグループのキー
export const UNSET_POSITION = '未設定'

// ポジションごとに選手をグループ分けする(PG→SG→SF→PF→C→未設定の順)。
// 第一・第二ポジションの両方を対象に含めるため、両方を持つ選手は該当する
// 両方のグループに現れる(例: PG/SGの選手はPGグループとSGグループの両方に表示)。
// 各グループ内は渡された配列の並び順(sort_order/背番号など)を保つ。
export function groupPlayersByPosition(players) {
  const buckets = new Map([...POSITIONS, UNSET_POSITION].map((key) => [key, []]))
  for (const p of players) {
    const positions = [p.position, p.position2].filter((pos) => POSITIONS.includes(pos))
    if (positions.length === 0) {
      buckets.get(UNSET_POSITION).push(p)
    } else {
      for (const pos of positions) {
        buckets.get(pos).push(p)
      }
    }
  }
  return [...POSITIONS, UNSET_POSITION]
    .map((key) => ({ key, players: buckets.get(key) }))
    .filter((g) => g.players.length > 0)
}

// 第一・第二ポジションをまとめて表示する("PG / SG"のように)
export function formatPositions(position, position2) {
  return [position, position2].filter(Boolean).join(' / ')
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const HALF_QUARTER_LABELS = { 1: '前半', 2: '後半', 3: '1OT' }

// periodSystemが'2q'(前半・後半・1OTの3区分)の試合と、それ以外(1Q〜4Q・OT1・OT2の
// 6区分、スクリメージ/シューティングも含む)とでクォーター表示を分ける
export function formatQuarter(quarter, periodSystem = '4q') {
  if (periodSystem === '2q') return HALF_QUARTER_LABELS[quarter] ?? `${quarter}`
  return quarter <= 4 ? `${quarter}Q` : `OT${quarter - 4}`
}

// 選択可能なクォーター。2Q制は前半・後半・1OTの3つ、それ以外は1〜4Q・OT1・OT2の6つ
export function quarterOptions(periodSystem = '4q') {
  return periodSystem === '2q' ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]
}

// スタッツリーダーの集計期間
export const LEADER_PERIODS = [
  { key: 'last5', label: '直近5試合' },
  { key: 'last3m', label: '直近3ヶ月' },
  { key: 'season', label: '今シーズン' },
  { key: 'all', label: '全期間' },
]

// 指定した期間に含める試合を絞り込む(date は 'YYYY-MM-DD' 形式の game_date)
export function filterGamesByPeriod(games, period, now = new Date()) {
  if (period === 'last5') {
    return games.slice(0, 5)
  }
  if (period === 'last3m' || period === 'season') {
    const cutoff = new Date(now)
    if (period === 'last3m') cutoff.setMonth(cutoff.getMonth() - 3)
    else cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return games.filter((g) => g.game_date >= cutoffStr)
  }
  return games
}
