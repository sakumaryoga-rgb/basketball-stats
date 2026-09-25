import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { buildScoreSheetViewModel, ScoreSheetAccessError } from '@/lib/scoreSheet/buildScoreSheetViewModel'
import { isScoreSheetEnabledForTeam } from '@/lib/scoreSheet/scoreSheetConfig'
import { formatClock, formatQuarter } from '@/lib/stats'
import { formatDate, formatMadeAttempt } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import './ScoreSheet.css'

// 運営者・チーム関係者向けの試合スコアシート(JBA/FIBAの記録形式、および実際に
// 現場で使われている非公式スコアシート様式を参考にしたBASKETBALL STATS独自の
// デジタル帳票)。閲覧のみ(Read Only)。現状はTokyo Comets(検証チーム)限定で
// 有効化している(scoreSheetConfig.js参照)。通常画面はレスポンシブ表示、印刷時のみ
// A4帳票レイアウトに切り替わる(ScoreSheet.css参照)。

function formatQuarterHeader(period, periodSystem) {
  return formatQuarter(period, periodSystem)
}

function Section({ title, note, children }) {
  return (
    <Card className="scoresheet-card">
      <CardHeader>
        <CardTitle className="font-heading tracking-wide">{title}</CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

// タイムアウト・チームファウルの箱(□)チェック表示。参考にした非公式様式の
// チェックボックス記入方式に合わせた四角形のマス目(pipsの四角版)。
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

// チームファウルのマス目を「1Q・2Q」「3Q・4Q」「OT(複数あれば併記)」のように
// 2区分ずつまとめる。参考様式のチームファウル欄が1Q/2Q・3Q/4Qの2段組みだったため。
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
      <span className="text-xs text-muted-foreground">
        使用 {team.timeoutsUsed} / 残り {team.timeoutsRemaining}
      </span>
    </div>
  )
}

function TeamFoulsGrid({ team, lastPeriod, periodSystem }) {
  if (!team.isSelf) {
    return <p className="text-sm text-muted-foreground">チームファウルの記録はありません(NOT_RECORDED)。</p>
  }
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
        <div>{team.coach ?? '—'}</div>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">アシスタントコーチ</span>
        <div>{team.assistantCoach ?? '—'}</div>
      </div>
    </div>
  )
}

const FOUL_BOX_COUNT = 5

function TeamRosterTable({ team, periodSystem }) {
  if (team.players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {team.name} の選手名簿はBASKETBALL STATS上で管理されていないため表示できません(対戦相手はチーム名・最終得点のみ記録されます)。
      </p>
    )
  }
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
          {team.players.map((p, i) => (
            <tr key={p.id}>
              <td className="tabular-nums">{i + 1}</td>
              <td className="text-muted-foreground">—</td>
              <td>
                {p.name}
                {p.isGuest && <span className="ml-1 text-[10px] text-muted-foreground">(ゲスト)</span>}
              </td>
              <td className="tabular-nums">{p.number ?? '—'}</td>
              <td>{p.startedOnCourt ? '○' : ''}</td>
              {Array.from({ length: FOUL_BOX_COUNT }, (_, idx) => (
                <td key={idx} className="scoresheet-foul-box-cell tabular-nums">
                  {p.foulSequence[idx] != null ? formatQuarterHeader(p.foulSequence[idx], periodSystem) : ''}
                </td>
              ))}
              <td className="tabular-nums">{p.stats.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Licenseは選手登録番号欄です(BASKETBALL STATSでは管理していないため常に「—」)。ファウル欄の数字は、そのファウルが発生したクォーターを示します(公式のP/T/U/D等の種別コードはstat_eventsに区別が無いため記録されていません)。
      </p>
    </div>
  )
}

// RUNNING SCORE: 得点した選手の背番号を、あらかじめ1,2,3...と昇順に並んだマスへ
// 書き込む形式(参考にした非公式スコアシート様式・JBA/FIBA公式スコアシート双方に
// 共通するランニングスコア欄)を再現する。1ブロック40点分(A/B列)を1単位とし、
// 到達点数に応じて必要なブロック数だけ表示する(紙のシートは4ブロック=160点固定だが、
// デジタルでは可変にして無駄な空欄を減らす)。
// 自チーム(Team A)は得点イベントの時系列データがあるため各マスに背番号を記入できるが、
// 相手チーム(Team B)は得点イベント単位のデータが保存されていないため、B列は常に空欄。
const LADDER_BLOCK_SIZE = 40

function RunningScoreBlocks({ scoringEvents, teamA, teamB }) {
  const maxScore = Math.max(teamA.finalScore, teamB.finalScore, 1)
  if (scoringEvents.length === 0 && maxScore <= 1) {
    return <p className="text-sm text-muted-foreground">この試合の得点イベントは記録されていません。</p>
  }

  const eventByTotal = new Map(scoringEvents.map((e) => [e.runningScoreSelf, e]))
  const lastEventIdInPeriod = new Map()
  for (const e of scoringEvents) lastEventIdInPeriod.set(e.period, e.id)
  const lastPeriodEventId = scoringEvents.length > 0 ? scoringEvents[scoringEvents.length - 1].id : null
  const shotClass = (type) => (type === '3PT' ? 'scoresheet-shot-3pt' : type === 'FT' ? 'scoresheet-shot-ft' : '')

  const blockCount = Math.max(1, Math.ceil(maxScore / LADDER_BLOCK_SIZE))
  const blockStarts = Array.from({ length: blockCount }, (_, b) => b * LADDER_BLOCK_SIZE + 1)

  return (
    <>
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
                const event = eventByTotal.get(value)
                const isPeriodEnd = event && lastEventIdInPeriod.get(event.period) === event.id
                const isGameEnd = event && event.id === lastPeriodEventId
                const rowClass = isGameEnd
                  ? 'scoresheet-ladder-row-game-end'
                  : isPeriodEnd
                    ? 'scoresheet-ladder-row-period-end'
                    : ''
                return (
                  <tr key={value} className={rowClass}>
                    <td className="scoresheet-ladder-value tabular-nums">{value}</td>
                    <td className="scoresheet-ladder-a">
                      {event ? <span className={shotClass(event.type)}>{event.playerNumber ?? '?'}</span> : ''}
                    </td>
                    <td className="scoresheet-ladder-b">—</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        凡例: <span className={shotClass('2PT')}>#</span> 2P成功 ／ <span className={shotClass('3PT')}>#</span> 3P成功(円で囲む) ／{' '}
        <span className={shotClass('FT')}>#</span> FT成功(塗りつぶし)。数字は背番号。B列(相手チーム)は得点イベント単位のデータが保存されていないため常に空欄です。
      </p>
    </>
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
              <td className="tabular-nums">{teamA.quarterScores[p - 1] ?? '—'}</td>
              <td className="tabular-nums text-muted-foreground">—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        相手チームはクォーター別得点の記録が無いため(累計のみ記録)、最終スコアのみ表示しています。
      </p>
    </div>
  )
}

function PlayerStatisticsTable({ team }) {
  if (team.players.length === 0) {
    return <p className="text-sm text-muted-foreground">{team.name} の個人スタッツは記録されていません。</p>
  }
  const totals = team.players.reduce(
    (acc, p) => {
      for (const key of ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']) {
        acc[key] += p.stats[key] ?? 0
      }
      return acc
    },
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 }
  )
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table">
        <thead>
          <tr>
            <th>選手</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>FG</th>
            <th>3P</th>
            <th>FT</th>
            <th>OREB</th>
            <th>DREB</th>
            <th>REB</th>
            <th>AST</th>
            <th>STL</th>
            <th>BLK</th>
            <th>TOV</th>
            <th>PF</th>
            <th>+/-</th>
          </tr>
        </thead>
        <tbody>
          {team.players.map((p) => (
            <tr key={p.id}>
              <td>
                {p.number != null ? `#${p.number} ` : ''}
                {p.name}
              </td>
              <td className="tabular-nums">{formatClock(p.secondsPlayed)}</td>
              <td className="tabular-nums">{p.stats.pts}</td>
              <td className="tabular-nums">{formatMadeAttempt(p.stats.fgm, p.stats.fga)}</td>
              <td className="tabular-nums">{formatMadeAttempt(p.stats.tpm, p.stats.tpa)}</td>
              <td className="tabular-nums">{formatMadeAttempt(p.stats.ftm, p.stats.fta)}</td>
              <td className="tabular-nums">{p.stats.oreb}</td>
              <td className="tabular-nums">{p.stats.dreb}</td>
              <td className="tabular-nums">{p.stats.reb}</td>
              <td className="tabular-nums">{p.stats.ast}</td>
              <td className="tabular-nums">{p.stats.stl}</td>
              <td className="tabular-nums">{p.stats.blk}</td>
              <td className="tabular-nums">{p.stats.tov}</td>
              <td className="tabular-nums">{p.stats.pf}</td>
              <td className="tabular-nums">{p.stats.plusMinus > 0 ? `+${p.stats.plusMinus}` : p.stats.plusMinus}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td>TEAM</td>
            <td className="tabular-nums text-muted-foreground">-</td>
            <td className="tabular-nums">{totals.pts}</td>
            <td className="tabular-nums">{formatMadeAttempt(totals.fgm, totals.fga)}</td>
            <td className="tabular-nums">{formatMadeAttempt(totals.tpm, totals.tpa)}</td>
            <td className="tabular-nums">{formatMadeAttempt(totals.ftm, totals.fta)}</td>
            <td className="tabular-nums text-muted-foreground" colSpan={1}>
              -
            </td>
            <td className="tabular-nums text-muted-foreground">-</td>
            <td className="tabular-nums">{totals.reb}</td>
            <td className="tabular-nums">{totals.ast}</td>
            <td className="tabular-nums">{totals.stl}</td>
            <td className="tabular-nums">{totals.blk}</td>
            <td className="tabular-nums">{totals.tov}</td>
            <td className="tabular-nums">{totals.pf}</td>
            <td className="tabular-nums text-muted-foreground">-</td>
          </tr>
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
      <TeamRosterTable team={team} periodSystem={game.periodSystem} />
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
        if (!isScoreSheetEnabledForTeam(result.teamA.teamId)) {
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

  const { game, teamA, teamB, scoringEvents, officials, result } = vm

  return (
    <div className="scoresheet-page">
      <div className="scoresheet-container">
        <div className="no-print flex items-center justify-between">
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
          <p className="text-xs text-muted-foreground">BASKETBALL SCORESHEET</p>
          <h1 className="text-xl font-heading tracking-wide">
            {teamA.name} vs {teamB.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            JBA/FIBA scorekeeping formatを参考にしたデジタルスコアシートです(公式帳票そのものではありません)。
          </p>
        </div>

        <Section title="GAME INFORMATION">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Competition</div>
              <div>{game.competition ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Game No.</div>
              <div>—</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Date</div>
              <div>{formatDate(game.date)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Start Time</div>
              <div>—</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Place</div>
              <div>{game.place ?? '—'}</div>
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
              <div>{officials.crewChief ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">1stアンパイア</div>
              <div>{officials.umpire1 ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">2ndアンパイア</div>
              <div>{officials.umpire2 ?? '—'}</div>
            </div>
          </div>
        </Section>

        <TeamSection team={teamA} label="TEAM A" game={game} />
        <TeamSection team={teamB} label="TEAM B" game={game} />

        <Section
          title="RUNNING SCORE"
          note={`${teamA.name}(自チーム)の得点をもとにした昇順ラダー形式です(参考にした非公式スコアシート様式・JBA/FIBA公式スコアシートのランニングスコア欄を参考にしています)。相手チームの得点はイベント単位のデータが保存されていないため、B列は常に空欄です(最終得点はSCOREに表示しています)。`}
        >
          <RunningScoreBlocks scoringEvents={scoringEvents} teamA={teamA} teamB={teamB} />
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
                {result.winner === 'self' ? teamA.name : result.winner === 'opponent' ? teamB.name : result.winner === 'tie' ? '—(同点)' : '未定'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">試合終了時間:</span>
              <span>—</span>
            </div>
          </div>
        </Section>

        <Section title="OFFICIALS" note="担当者名を入力する仕組みが現状のアプリに無いため、全項目未記入です。">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ['スコアラー', officials.scorer],
              ['Aスコアラー', officials.assistantScorer],
              ['タイマー', officials.timer],
              ['ショットクロック', officials.shotClockOperator],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div>{value ?? '—'}</div>
              </div>
            ))}
          </div>
        </Section>

        <div className="scoresheet-page-break flex flex-col gap-1 scoresheet-avoid-break">
          <p className="text-xs text-muted-foreground">BASKETBALL STATS — PLAYER STATISTICS</p>
          <h2 className="text-lg font-heading tracking-wide">個人スタッツ</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Section title={`${teamA.name}`}>
            <PlayerStatisticsTable team={teamA} />
          </Section>
          <Section title={`${teamB.name}`}>
            <PlayerStatisticsTable team={teamB} />
          </Section>
        </div>

        <p className="no-print text-xs text-muted-foreground">生成時刻: {new Date(vm.generatedAt).toLocaleString('ja-JP')}</p>
      </div>
    </div>
  )
}
