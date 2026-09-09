import { Link } from 'react-router-dom'
import { formatMadeAttempt } from '@/lib/format'
import { formatClock, formatPlusMinus } from '@/lib/stats'

const TEAM_TOTAL_KEYS = ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']

// 試合のボックススコア(選手ごとの成績)を表示する横スクロール可能な表
export function BoxScoreTable({ rows, linkToPlayers = false }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">まだスタッツがありません</p>
  }

  const teamTotals = rows.reduce((acc, row) => {
    for (const key of TEAM_TOTAL_KEYS) acc[key] += row[key] ?? 0
    return acc
  }, Object.fromEntries(TEAM_TOTAL_KEYS.map((key) => [key, 0])))

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-left font-normal py-2 pr-3">選手</th>
            <th className="text-right font-normal font-latin py-2 px-2">MIN</th>
            <th className="text-right font-normal font-latin py-2 px-2">PTS</th>
            <th className="text-right font-normal font-latin py-2 px-2">REB</th>
            <th className="text-right font-normal font-latin py-2 px-2">AST</th>
            <th className="text-right font-normal font-latin py-2 px-2">STL</th>
            <th className="text-right font-normal font-latin py-2 px-2">BLK</th>
            <th className="text-right font-normal font-latin py-2 px-2">TO</th>
            <th className="text-right font-normal font-latin py-2 px-2">PF</th>
            <th className="text-right font-normal font-latin py-2 px-2">FG</th>
            <th className="text-right font-normal font-latin py-2 px-2">3P</th>
            <th className="text-right font-normal font-latin py-2 px-2">FT</th>
            <th className="text-right font-normal py-2 pl-2 font-latin">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-2 pr-3 whitespace-nowrap">
                {linkToPlayers && !row.isGuest ? (
                  <Link to={`/players/${row.id}`} className="hover:underline">
                    {row.number != null ? `#${row.number} ` : ''}
                    {row.name}
                  </Link>
                ) : (
                  <>
                    {row.number != null ? `#${row.number} ` : ''}
                    {row.name}
                  </>
                )}
                {row.isGuest && (
                  <span className="ml-1 rounded bg-muted-foreground/20 px-1 text-[10px] leading-4 align-middle">ゲスト</span>
                )}
              </td>
              <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap text-muted-foreground">
                {formatClock(row.seconds_played ?? 0)}
              </td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.pts}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.reb}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.ast}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.stl}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.blk}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.tov}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums">{row.pf}</td>
              <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.fgm, row.fga)}
              </td>
              <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.tpm, row.tpa)}
              </td>
              <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.ftm, row.fta)}
              </td>
              <td className="text-right py-2 pl-2 font-latin tabular-nums">{formatPlusMinus(row.plus_minus)}</td>
            </tr>
          ))}
          <tr className="border-t-2 bg-muted/30">
            <td className="py-2 pr-3 whitespace-nowrap">TEAM</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums text-muted-foreground">-</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.pts}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.reb}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.ast}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.stl}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.blk}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.tov}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums">{teamTotals.pf}</td>
            <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
              {formatMadeAttempt(teamTotals.fgm, teamTotals.fga)}
            </td>
            <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
              {formatMadeAttempt(teamTotals.tpm, teamTotals.tpa)}
            </td>
            <td className="text-right py-2 px-2 font-latin tabular-nums whitespace-nowrap">
              {formatMadeAttempt(teamTotals.ftm, teamTotals.fta)}
            </td>
            <td className="text-right py-2 pl-2 font-latin tabular-nums text-muted-foreground">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
