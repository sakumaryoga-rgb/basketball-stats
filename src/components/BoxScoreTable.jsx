import { Link } from 'react-router-dom'
import { formatMadeAttempt } from '@/lib/format'
import { formatClock, formatPlusMinus } from '@/lib/stats'

// 試合のボックススコア(選手ごとの成績)を表示する横スクロール可能な表
export function BoxScoreTable({ rows, linkToPlayers = false }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">まだスタッツがありません</p>
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="text-xs text-muted-foreground border-b">
            <th className="text-left font-normal py-2 pr-3">選手</th>
            <th className="text-right font-normal py-2 px-2">MIN</th>
            <th className="text-right font-normal py-2 px-2">PTS</th>
            <th className="text-right font-normal py-2 px-2">REB</th>
            <th className="text-right font-normal py-2 px-2">AST</th>
            <th className="text-right font-normal py-2 px-2">STL</th>
            <th className="text-right font-normal py-2 px-2">BLK</th>
            <th className="text-right font-normal py-2 px-2">TO</th>
            <th className="text-right font-normal py-2 px-2">PF</th>
            <th className="text-right font-normal py-2 px-2">FG</th>
            <th className="text-right font-normal py-2 px-2">3P</th>
            <th className="text-right font-normal py-2 px-2">FT</th>
            <th className="text-right font-normal py-2 pl-2 font-latin">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-2 pr-3 font-medium whitespace-nowrap">
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
              <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap text-muted-foreground">
                {formatClock(row.seconds_played ?? 0)}
              </td>
              <td className="text-right py-2 px-2 tabular-nums font-medium">{row.pts}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.reb}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.ast}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.stl}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.blk}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.tov}</td>
              <td className="text-right py-2 px-2 tabular-nums">{row.pf}</td>
              <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.fgm, row.fga)}
              </td>
              <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.tpm, row.tpa)}
              </td>
              <td className="text-right py-2 px-2 tabular-nums whitespace-nowrap">
                {formatMadeAttempt(row.ftm, row.fta)}
              </td>
              <td className="text-right py-2 pl-2 tabular-nums font-latin">{formatPlusMinus(row.plus_minus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
