import {
  formatQuarterHeader,
  FOUL_BOX_COUNT,
  PRINT_ROSTER_ROW_COUNT,
  LADDER_BLOCK_SIZE,
  groupPeriodsForFoulGrid,
  periodEndMap,
  buildRosterPageRows,
} from '@/lib/scoreSheet/scoreSheetLayout'
import { formatDate } from '@/lib/format'
import './ScoreSheetPrint.css'

// 印刷/PDF出力専用のスコアシートコンポーネント。ScoreSheet.jsx(画面表示用の
// レスポンシブUI)とはCSS・DOM構造とも完全に独立している。
//
// 【なぜ分離したか】以前は1つのレスポンシブDOMを@media printで大量に上書きする
// 方式だったが、Tailwindのsm:/md:等のレスポンシブユーティリティは「そのDOMが
// 置かれた要素の幅」ではなく「viewport(印刷時はpage box)の幅」を基準に評価される。
// @page/paged mediaのpage box解釈はブラウザ・OSによって差があり得るため、
// 「印刷を実行した端末のビューポート幅」によって適用されるレスポンシブクラスが
// 変わってしまう(モバイル端末から印刷すると画面表示相当の2列レイアウトのまま
// 出力される等)可能性を完全には排除できなかった。
//
// このコンポーネントはTailwindのレスポンシブユーティリティ(sm:/md:等)は
// もちろん、Tailwindのユーティリティクラス自体を一切使わない。全ての列数・幅は
// ScoreSheetPrint.css内で%/mm/pt等の固定値として明示し、印刷を実行した端末の
// ビューポート幅に左右される要素をコンポーネント内に一つも残さないようにしている。
//
// 高さは常にauto(コンテンツ量に応じて自然に決まる)。max-height/固定heightは
// 一切使わず、内容がA4 1枚に収まらない場合は自然な改ページを許容する
// (overflow:hiddenによる内容の切り落としは行わない)。
//
// データはScoreSheet.jsxと同じScoreSheetViewModel(buildScoreSheetViewModel.js)を
// そのまま受け取り、ロジック(クォーターのグルーピング等)もscoreSheetLayout.jsを
// 共有することで、画面表示用コンポーネントとの二重実装を避けている。

function SspBlank({ value, width }) {
  if (value != null && value !== '') return <>{value}</>
  return <span className="ssp-blank" style={width ? { width } : undefined} />
}

function SspBoxes({ used, total }) {
  const filled = Math.min(used, total)
  const overflow = Math.max(0, used - total)
  return (
    <span className="ssp-boxes">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? 'ssp-box ssp-box-filled' : 'ssp-box'} />
      ))}
      {overflow > 0 && <span className="ssp-box-overflow">+{overflow}</span>}
    </span>
  )
}

function sspShotClass(type) {
  return type === '3PT' ? 'ssp-shot-3pt' : type === 'FT' ? 'ssp-shot-ft' : ''
}

function SspField({ label, children }) {
  return (
    <div className="ssp-field">
      <div className="ssp-field-label">{label}</div>
      <div className="ssp-field-value">{children}</div>
    </div>
  )
}

function SspTimeoutsLine({ team }) {
  return (
    <div className="ssp-timeout-line">
      <span className="ssp-meta-label">タイムアウト</span>
      <SspBoxes used={team.timeoutsUsed} total={team.timeoutsTotal} />
    </div>
  )
}

function SspFoulsGrid({ team, lastPeriod, periodSystem }) {
  const foulByPeriod = new Map(team.teamFoulsByPeriod.map((f) => [f.period, f.count]))
  const rows = groupPeriodsForFoulGrid(lastPeriod, periodSystem)
  return (
    <div className="ssp-foul-grid">
      <span className="ssp-meta-label">チームファウル</span>
      {rows.map((periods, i) => (
        <div key={i} className="ssp-foul-grid-row">
          {periods.map((p) => (
            <span key={p} className="ssp-foul-grid-cell">
              <span className="ssp-foul-grid-label">{formatQuarterHeader(p, periodSystem)}</span>
              <SspBoxes used={foulByPeriod.get(p) ?? 0} total={4} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function SspRosterTable({ rows, startIndex, periodSystem }) {
  return (
    <table className="ssp-roster-table">
      <colgroup>
        <col className="ssp-col-no" />
        <col className="ssp-col-name" />
        <col className="ssp-col-number" />
        <col className="ssp-col-starter" />
        {Array.from({ length: FOUL_BOX_COUNT }, (_, i) => (
          <col key={i} className="ssp-col-foul" />
        ))}
        <col className="ssp-col-pts" />
      </colgroup>
      <thead>
        <tr>
          <th>No.</th>
          <th className="ssp-col-name-align">選手氏名</th>
          <th>#</th>
          <th>STARTER</th>
          <th colSpan={FOUL_BOX_COUNT}>ファウル</th>
          <th>PTS</th>
        </tr>
        <tr>
          <th colSpan={4}></th>
          {Array.from({ length: FOUL_BOX_COUNT }, (_, i) => (
            <th key={i} className="ssp-foul-col-header">
              {i + 1}
            </th>
          ))}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <tr key={p?.id ?? `blank-${startIndex + i}`}>
            <td>{startIndex + i + 1}</td>
            <td className="ssp-col-name-align">
              {p ? (
                <>
                  {p.name}
                  {p.isGuest && <span className="ssp-guest-tag">(ゲスト)</span>}
                </>
              ) : (
                <SspBlank value={null} />
              )}
            </td>
            <td>{p ? (p.number ?? <SspBlank value={null} />) : <SspBlank value={null} />}</td>
            <td>{p?.startedOnCourt ? '○' : ''}</td>
            {Array.from({ length: FOUL_BOX_COUNT }, (_, idx) => (
              <td key={idx} className="ssp-foul-box-cell">
                {p?.foulSequence?.[idx] != null ? formatQuarterHeader(p.foulSequence[idx], periodSystem) : ''}
              </td>
            ))}
            <td>{p ? p.stats.pts : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SspCoachRow({ team }) {
  return (
    <div className="ssp-coach-row">
      <SspField label="ヘッドコーチ">
        <SspBlank value={team.coach} width="24mm" />
      </SspField>
      <SspField label="アシスタントコーチ">
        <SspBlank value={team.assistantCoach} width="24mm" />
      </SspField>
    </div>
  )
}

function SspTeamSection({ team, label, game }) {
  // 1ページ目は常にPRINT_ROSTER_ROW_COUNT(12)行固定。出場人数が12人を超える分
  // (13人目以降)はこのページには含めず、2ページ目(SspOverflowSection)に回す。
  const page1Rows = buildRosterPageRows(team.players.slice(0, PRINT_ROSTER_ROW_COUNT), PRINT_ROSTER_ROW_COUNT)
  return (
    <div className="ssp-card">
      <div className="ssp-card-title">
        {label} — {team.name}
      </div>
      <div className="ssp-meta-row">
        <SspTimeoutsLine team={team} />
        <SspFoulsGrid team={team} lastPeriod={game.lastPeriod} periodSystem={game.periodSystem} />
      </div>
      <SspRosterTable rows={page1Rows} startIndex={0} periodSystem={game.periodSystem} />
      <SspCoachRow team={team} />
    </div>
  )
}

// 13人目以降の出場者を継続表示する2ページ目のセクション。出場人数が12人以下の
// チームは対象外(呼び出し側でnullを返して非表示にする)。
function SspOverflowSection({ team, label, game }) {
  const overflowPlayers = team.players.slice(PRINT_ROSTER_ROW_COUNT)
  if (overflowPlayers.length === 0) return null
  return (
    <div className="ssp-card">
      <div className="ssp-card-title">
        {label} — {team.name}(13人目以降)
      </div>
      <SspRosterTable rows={overflowPlayers} startIndex={PRINT_ROSTER_ROW_COUNT} periodSystem={game.periodSystem} />
    </div>
  )
}

function SspRunningScore({ scoringEvents, opponentScoringEvents, teamA, teamB }) {
  const maxScore = Math.max(teamA.finalScore, teamB.finalScore, LADDER_BLOCK_SIZE)

  const eventByTotalA = new Map(scoringEvents.map((e) => [e.runningScoreSelf, e]))
  const eventByTotalB = new Map(opponentScoringEvents.map((e) => [e.runningScoreOpponent, e]))
  const { lastEventIdInPeriod: lastA, lastEventId: lastGameA } = periodEndMap(scoringEvents)
  const { lastEventIdInPeriod: lastB, lastEventId: lastGameB } = periodEndMap(opponentScoringEvents)

  const blockCount = Math.max(1, Math.ceil(maxScore / LADDER_BLOCK_SIZE))
  const blockStarts = Array.from({ length: blockCount }, (_, b) => b * LADDER_BLOCK_SIZE + 1)

  return (
    <div className="ssp-card">
      <div className="ssp-card-title">RUNNING SCORE</div>
      <div className="ssp-ladder-grid">
        {blockStarts.map((start) => (
          <table key={start} className="ssp-ladder-table">
            <thead>
              <tr>
                <th></th>
                <th>A</th>
                <th>B</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: LADDER_BLOCK_SIZE }, (_, i) => {
                const value = start + i
                const eventA = eventByTotalA.get(value)
                const eventB = eventByTotalB.get(value)
                const cellClassA = eventA && eventA.id === lastGameA ? 'ssp-ladder-game-end' : eventA && lastA.get(eventA.period) === eventA.id ? 'ssp-ladder-period-end' : ''
                const cellClassB = eventB && eventB.id === lastGameB ? 'ssp-ladder-game-end' : eventB && lastB.get(eventB.period) === eventB.id ? 'ssp-ladder-period-end' : ''
                return (
                  <tr key={value}>
                    <td className="ssp-ladder-value">{value}</td>
                    <td className={cellClassA}>{eventA ? <span className={sspShotClass(eventA.type)}>{eventA.playerNumber ?? ''}</span> : ''}</td>
                    <td className={cellClassB}>
                      {eventB ? (
                        eventB.type === '2PT' ? (
                          <span className="ssp-shot-2pt-mark">・</span>
                        ) : (
                          <span className={sspShotClass(eventB.type)}>&nbsp;</span>
                        )
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  )
}

function SspScoreCard({ vm }) {
  const { teamA, teamB, game, result } = vm
  const periods = Array.from({ length: game.lastPeriod }, (_, i) => i + 1)
  return (
    <div className="ssp-card">
      <div className="ssp-card-title">SCORE</div>
      <table className="ssp-score-table">
        <thead>
          <tr>
            <th></th>
            <th>A: {teamA.name}</th>
            <th>B: {teamB.name}</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p}>
              <td className="ssp-col-name-align">{formatQuarterHeader(p, game.periodSystem)}</td>
              <td>{teamA.quarterScores[p - 1] ?? ''}</td>
              <td>{teamB.quarterScores[p - 1] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ssp-result-row">
        <span>
          最終スコア: <strong>{teamA.finalScore} — {teamB.finalScore}</strong>
        </span>
        <span>
          勝利チーム:{' '}
          <strong>
            {result.winner === 'self' ? teamA.name : result.winner === 'opponent' ? teamB.name : result.winner === 'tie' ? '—(同点)' : <SspBlank value={null} width="20mm" />}
          </strong>
        </span>
        <span>
          試合終了時間: <SspBlank value={null} width="16mm" />
        </span>
      </div>
    </div>
  )
}

export function ScoreSheetPrint({ vm }) {
  if (!vm) return null
  const { game, teamA, teamB, scoringEvents, opponentScoringEvents, officials } = vm
  // 出場人数がTeam A/Bどちらか一方でも12人を超える場合のみ、13人目以降をまとめた
  // 2ページ目を生成する(超過が無い場合は2ページ目自体を作らない)。
  const overflowA = teamA.players.length > PRINT_ROSTER_ROW_COUNT
  const overflowB = teamB.players.length > PRINT_ROSTER_ROW_COUNT
  const hasOverflow = overflowA || overflowB

  return (
    <div className="ssp-root">
      <div className="ssp-header">
        <div className="ssp-brand">
          <img src="/icons/icon-512.png" alt="" className="ssp-logo" />
          <span className="ssp-brand-name">BASKETBALL STATS</span>
        </div>
        <div className="ssp-doctype">GAME SCORESHEET</div>
        <h1 className="ssp-title">
          {teamA.name} vs {teamB.name}
        </h1>
      </div>

      <div className="ssp-card">
        <div className="ssp-card-title">GAME INFORMATION</div>
        <div className="ssp-info-grid">
          <SspField label="Competition">
            <SspBlank value={game.competition} width="30mm" />
          </SspField>
          <SspField label="Game No.">
            <SspBlank value={null} width="14mm" />
          </SspField>
          <SspField label="Date">{formatDate(game.date)}</SspField>
          <SspField label="Start Time">
            <SspBlank value={null} width="14mm" />
          </SspField>
          <SspField label="Place">
            <SspBlank value={game.place} width="30mm" />
          </SspField>
          <SspField label="Status">
            <span className="ssp-status-badge">{game.status === 'final' ? '終了' : game.status === 'in_progress' ? '試合中' : '予定'}</span>
          </SspField>
          <SspField label="クルーチーフ">
            <SspBlank value={officials.crewChief} width="30mm" />
          </SspField>
          <SspField label="1stアンパイア">
            <SspBlank value={officials.umpire1} width="30mm" />
          </SspField>
          <SspField label="2ndアンパイア">
            <SspBlank value={officials.umpire2} width="30mm" />
          </SspField>
        </div>
      </div>

      <div className="ssp-grid">
        <div className="ssp-grid-left">
          <SspTeamSection team={teamA} label="TEAM A" game={game} />
          <SspTeamSection team={teamB} label="TEAM B" game={game} />
        </div>
        <div className="ssp-grid-right">
          <SspRunningScore scoringEvents={scoringEvents} opponentScoringEvents={opponentScoringEvents} teamA={teamA} teamB={teamB} />
          <SspScoreCard vm={vm} />
        </div>
      </div>

      <div className="ssp-card">
        <div className="ssp-card-title">OFFICIALS</div>
        <div className="ssp-officials-grid">
          <SspField label="スコアラー">
            <SspBlank value={officials.scorer} width="20mm" />
          </SspField>
          <SspField label="Aスコアラー">
            <SspBlank value={officials.assistantScorer} width="20mm" />
          </SspField>
          <SspField label="タイマー">
            <SspBlank value={officials.timer} width="20mm" />
          </SspField>
          <SspField label="ショットクロック">
            <SspBlank value={officials.shotClockOperator} width="20mm" />
          </SspField>
        </div>
      </div>

      {hasOverflow && (
        <div className="ssp-page2">
          <div className="ssp-header ssp-header-continued">
            <div className="ssp-brand">
              <img src="/icons/icon-512.png" alt="" className="ssp-logo" />
              <span className="ssp-brand-name">BASKETBALL STATS</span>
            </div>
            <div className="ssp-doctype">GAME SCORESHEET CONTINUED</div>
            <h1 className="ssp-title">
              {teamA.name} vs {teamB.name}
            </h1>
          </div>
          {overflowA && <SspOverflowSection team={teamA} label="TEAM A" game={game} />}
          {overflowB && <SspOverflowSection team={teamB} label="TEAM B" game={game} />}
        </div>
      )}
    </div>
  )
}
