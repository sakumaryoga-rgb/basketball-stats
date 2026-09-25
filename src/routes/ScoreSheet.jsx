import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { buildScoreSheetViewModel, ScoreSheetAccessError } from '@/lib/scoreSheet/buildScoreSheetViewModel'
import { isTeamInTestGroup } from '@/lib/testTeamConfig'
import { formatQuarter } from '@/lib/stats'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import './ScoreSheet.css'

// 運営者・チーム関係者向けの試合スコアシート(JBA/FIBAの記録形式、および実際に
// 現場で使われている非公式スコアシート様式を参考にしたBASKETBALL STATS独自の
// デジタル帳票)。閲覧のみ(Read Only)。現状はTokyo Comets(検証チーム)限定で
// 有効化している(testTeamConfig.js参照)。通常画面はレスポンシブ表示、印刷時のみ
// A4 1枚に収まるレイアウトへ切り替わる(ScoreSheet.css参照)。
// BASKETBALL STATSに保存されていない項目は空欄(手書き記入欄)として表示し、
// 「未記録」等の注記は付けない(印刷して実際に手書きで使えることを優先する)。

function formatQuarterHeader(period, periodSystem) {
  return formatQuarter(period, periodSystem)
}

function Section({ title, children }) {
  return (
    <Card className="scoresheet-card">
      <CardHeader>
        <CardTitle className="font-heading tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

// データが無い項目を、手書きで後から書き込める空欄(下線)として表示する。
function Blank({ value, minWidth }) {
  if (value != null && value !== '') return <>{value}</>
  return <span className="scoresheet-blank" style={minWidth ? { minWidth } : undefined} />
}

// タイムアウト・チームファウルの箱(□)チェック表示。
function Boxes({ used, total }) {
  const filled = Math.min(used, total)
  const overflow = Math.max(0, used - total)
  return (
    <span className="scoresheet-boxes">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? 'scoresheet-box scoresheet-box-filled' : 'scoresheet-box'} />
      ))}
      {overflow > 0 && <span className="scoresheet-pip-overflow">+{overflow}</span>}
    </span>
  )
}

// チームファウルのマス目を「1Q・2Q」「3Q・4Q」「OT」のように2区分ずつまとめる。
function groupPeriodsForFoulGrid(lastPeriod, periodSystem) {
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

function TeamTimeoutsLine({ team }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs text-muted-foreground">タイムアウト</span>
      <Boxes used={team.timeoutsUsed} total={team.timeoutsTotal} />
    </div>
  )
}

function TeamFoulsGrid({ team, lastPeriod, periodSystem }) {
  // 相手チームはクォーター別の記録を持たないため、全マス未記入の同じ枠を表示する
  // (印刷して手書きで使えるように、注記は付けない)。
  const foulByPeriod = new Map(team.teamFoulsByPeriod.map((f) => [f.period, f.count]))
  const rows = groupPeriodsForFoulGrid(lastPeriod, periodSystem)
  return (
    <div className="scoresheet-foul-grid">
      <span className="text-xs text-muted-foreground">チームファウル</span>
      {rows.map((periods, i) => (
        <div key={i} className="scoresheet-foul-grid-row">
          {periods.map((p) => (
            <div key={p} className="scoresheet-foul-grid-cell">
              <span className="scoresheet-foul-grid-label">{formatQuarterHeader(p, periodSystem)}</span>
              <Boxes used={foulByPeriod.get(p) ?? 0} total={4} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function TeamCoachLine({ team }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-xs text-muted-foreground">ヘッドコーチ</span>
        <div>
          <Blank value={team.coach} minWidth="8em" />
        </div>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">アシスタントコーチ</span>
        <div>
          <Blank value={team.assistantCoach} minWidth="8em" />
        </div>
      </div>
    </div>
  )
}

const FOUL_BOX_COUNT = 5
// 相手チームの選手名簿はBASKETBALL STATSで管理していないため、自チームの
// 人数に合わせた空欄の行を用意し、手書きで記入できるようにする
const MIN_BLANK_ROSTER_ROWS = 5

function TeamRosterTable({ team, periodSystem, blankRowCount }) {
  const rows = team.players.length > 0 ? team.players : Array.from({ length: Math.max(blankRowCount, MIN_BLANK_ROSTER_ROWS) })
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table scoresheet-roster-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>License</th>
            <th>選手氏名</th>
            <th>#</th>
            <th>STARTER</th>
            <th colSpan={FOUL_BOX_COUNT}>ファウル</th>
            <th>PTS</th>
          </tr>
          <tr>
            <th colSpan={5}></th>
            {Array.from({ length: FOUL_BOX_COUNT }, (_, i) => (
              <th key={i} className="scoresheet-foul-col-header">
                {i + 1}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p?.id ?? i}>
              <td className="tabular-nums">{i + 1}</td>
              <td>
                <Blank value={null} minWidth="3em" />
              </td>
              <td>
                {p ? (
                  <>
                    {p.name}
                    {p.isGuest && <span className="ml-1 text-[10px] text-muted-foreground">(ゲスト)</span>}
                  </>
                ) : (
                  <Blank value={null} minWidth="7em" />
                )}
              </td>
              <td className="tabular-nums">{p ? (p.number ?? <Blank value={null} minWidth="2em" />) : <Blank value={null} minWidth="2em" />}</td>
              <td>{p?.startedOnCourt ? '○' : ''}</td>
              {Array.from({ length: FOUL_BOX_COUNT }, (_, idx) => (
                <td key={idx} className="scoresheet-foul-box-cell tabular-nums">
                  {p?.foulSequence?.[idx] != null ? formatQuarterHeader(p.foulSequence[idx], periodSystem) : ''}
                </td>
              ))}
              <td className="tabular-nums">{p ? p.stats.pts : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// RUNNING SCORE: 得点した選手の背番号を、あらかじめ1,2,3...と昇順に並んだマスへ
// 書き込む形式。1ブロック40点分(A/B列)を1単位とし、両チームの到達点数に応じて
// 必要なブロック数だけ表示する。自チーム(A)は得点イベントに選手の背番号が
// 紐づくため番号を記入できるが、相手チーム(B)は選手名簿を持たないため、
// ショット種別のマーク(2P/3P/FT)のみを記入する。
const LADDER_BLOCK_SIZE = 40

function shotClass(type) {
  return type === '3PT' ? 'scoresheet-shot-3pt' : type === 'FT' ? 'scoresheet-shot-ft' : ''
}

function periodEndMap(events) {
  const lastEventIdInPeriod = new Map()
  for (const e of events) lastEventIdInPeriod.set(e.period, e.id)
  const lastEventId = events.length > 0 ? events[events.length - 1].id : null
  return { lastEventIdInPeriod, lastEventId }
}

function RunningScoreBlocks({ scoringEvents, opponentScoringEvents, teamA, teamB }) {
  const maxScore = Math.max(teamA.finalScore, teamB.finalScore, LADDER_BLOCK_SIZE)

  const eventByTotalA = new Map(scoringEvents.map((e) => [e.runningScoreSelf, e]))
  const eventByTotalB = new Map(opponentScoringEvents.map((e) => [e.runningScoreOpponent, e]))
  const { lastEventIdInPeriod: lastA, lastEventId: lastGameA } = periodEndMap(scoringEvents)
  const { lastEventIdInPeriod: lastB, lastEventId: lastGameB } = periodEndMap(opponentScoringEvents)

  const blockCount = Math.max(1, Math.ceil(maxScore / LADDER_BLOCK_SIZE))
  const blockStarts = Array.from({ length: blockCount }, (_, b) => b * LADDER_BLOCK_SIZE + 1)

  return (
    <div className="scoresheet-ladder-grid">
      {blockStarts.map((start) => (
        <table key={start} className="scoresheet-ladder-table">
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
              const cellClassA = eventA && eventA.id === lastGameA ? 'scoresheet-ladder-game-end' : eventA && lastA.get(eventA.period) === eventA.id ? 'scoresheet-ladder-period-end' : ''
              const cellClassB = eventB && eventB.id === lastGameB ? 'scoresheet-ladder-game-end' : eventB && lastB.get(eventB.period) === eventB.id ? 'scoresheet-ladder-period-end' : ''
              return (
                <tr key={value}>
                  <td className="scoresheet-ladder-value tabular-nums">{value}</td>
                  <td className={`scoresheet-ladder-a ${cellClassA}`}>
                    {eventA ? <span className={shotClass(eventA.type)}>{eventA.playerNumber ?? ''}</span> : ''}
                  </td>
                  <td className={`scoresheet-ladder-b ${cellClassB}`}>
                    {eventB ? (
                      eventB.type === '2PT' ? (
                        <span className="scoresheet-shot-2pt-mark">・</span>
                      ) : (
                        <span className={shotClass(eventB.type)}>&nbsp;</span>
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
  )
}

function ScoreTable({ vm }) {
  const { teamA, teamB, game } = vm
  const periods = Array.from({ length: game.lastPeriod }, (_, i) => i + 1)
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table scoresheet-score-table">
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
              <td>{formatQuarterHeader(p, game.periodSystem)}</td>
              <td className="tabular-nums">{teamA.quarterScores[p - 1] ?? ''}</td>
              <td className="tabular-nums">{teamB.quarterScores[p - 1] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamSection({ team, label, game }) {
  return (
    <Section title={`${label} — ${team.name}`}>
      <TeamTimeoutsLine team={team} />
      <TeamFoulsGrid team={team} lastPeriod={game.lastPeriod} periodSystem={game.periodSystem} />
      <TeamRosterTable team={team} periodSystem={game.periodSystem} blankRowCount={game.teamAPlayerCount} />
      <TeamCoachLine team={team} />
    </Section>
  )
}

export function ScoreSheet() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | not-found | disabled | error
  const [vm, setVm] = useState(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    buildScoreSheetViewModel(gameId)
      .then((result) => {
        if (cancelled) return
        if (result.game.gameType === 'shooting') {
          setStatus('unsupported-game-type')
          return
        }
        if (!isTeamInTestGroup(result.teamA.teamId)) {
          setStatus('disabled')
          return
        }
        setVm(result)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('スコアシートの取得に失敗しました', err)
        setStatus(err instanceof ScoreSheetAccessError ? 'not-found' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  if (status === 'loading') {
    return <div className="scoresheet-page flex min-h-svh items-center justify-center text-muted-foreground">読み込み中...</div>
  }
  if (status === 'not-found') {
    return (
      <div className="scoresheet-page flex min-h-svh flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-destructive">この試合が見つからないか、閲覧権限がありません。</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          戻る
        </Button>
      </div>
    )
  }
  if (status === 'unsupported-game-type') {
    return (
      <div className="scoresheet-page flex min-h-svh flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">シューティング記録にはスコアシート機能は対応していません。</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          戻る
        </Button>
      </div>
    )
  }
  if (status === 'disabled') {
    return (
      <div className="scoresheet-page flex min-h-svh flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-muted-foreground">この機能は現在テスト運用中のため、一部チームのみご利用いただけます。</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          戻る
        </Button>
      </div>
    )
  }
  if (status === 'error' || !vm) {
    return (
      <div className="scoresheet-page flex min-h-svh flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-destructive">スコアシートの取得に失敗しました。</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          戻る
        </Button>
      </div>
    )
  }

  const { game, teamA, teamB, scoringEvents, opponentScoringEvents, officials, result } = vm
  const gameWithRosterCount = { ...game, teamAPlayerCount: teamA.players.length }

  return (
    <div className="scoresheet-page">
      <div className="scoresheet-container">
        <div className="no-print flex items-center justify-between pt-[env(safe-area-inset-top)]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="size-4" />
            戻る
          </button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            印刷 / PDF保存
          </Button>
        </div>

        <div className="flex flex-col gap-1 scoresheet-avoid-break">
          <div className="flex items-center gap-1.5">
            <img src="/icons/icon-512.png" alt="" className="scoresheet-brand-logo" />
            <p className="text-xs font-semibold tracking-wide">BASKETBALL STATS</p>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">GAME SCORESHEET</p>
          <h1 className="text-xl font-heading tracking-wide">
            {teamA.name} vs {teamB.name}
          </h1>
        </div>

        <Section title="GAME INFORMATION">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Competition</div>
              <div>
                <Blank value={game.competition} minWidth="8em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Game No.</div>
              <div>
                <Blank value={null} minWidth="4em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Date</div>
              <div>{formatDate(game.date)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Start Time</div>
              <div>
                <Blank value={null} minWidth="4em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Place</div>
              <div>
                <Blank value={game.place} minWidth="8em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div>
                <Badge variant={game.status === 'final' ? 'secondary' : 'default'}>
                  {game.status === 'final' ? '終了' : game.status === 'in_progress' ? '試合中' : '予定'}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">クルーチーフ</div>
              <div>
                <Blank value={officials.crewChief} minWidth="8em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">1stアンパイア</div>
              <div>
                <Blank value={officials.umpire1} minWidth="8em" />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">2ndアンパイア</div>
              <div>
                <Blank value={officials.umpire2} minWidth="8em" />
              </div>
            </div>
          </div>
        </Section>

        <div className="scoresheet-grid">
          <div className="scoresheet-grid-left">
            <TeamSection team={teamA} label="TEAM A" game={gameWithRosterCount} />
            <TeamSection team={teamB} label="TEAM B" game={gameWithRosterCount} />
          </div>
          <div className="scoresheet-grid-right">
            <Section title="RUNNING SCORE">
              <RunningScoreBlocks
                scoringEvents={scoringEvents}
                opponentScoringEvents={opponentScoringEvents}
                teamA={teamA}
                teamB={teamB}
              />
            </Section>

            <Section title="SCORE">
              <ScoreTable vm={vm} />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">最終スコア:</span>
                  <span className="font-semibold tabular-nums">
                    {teamA.finalScore} — {teamB.finalScore}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">勝利チーム:</span>
                  <span className="font-semibold">
                    {result.winner === 'self' ? (
                      teamA.name
                    ) : result.winner === 'opponent' ? (
                      teamB.name
                    ) : result.winner === 'tie' ? (
                      '—(同点)'
                    ) : (
                      <Blank value={null} minWidth="6em" />
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">試合終了時間:</span>
                  <Blank value={null} minWidth="4em" />
                </div>
              </div>
            </Section>
          </div>
        </div>

        <Section title="OFFICIALS">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ['スコアラー', officials.scorer],
              ['Aスコアラー', officials.assistantScorer],
              ['タイマー', officials.timer],
              ['ショットクロック', officials.shotClockOperator],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div>
                  <Blank value={value} minWidth="6em" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
