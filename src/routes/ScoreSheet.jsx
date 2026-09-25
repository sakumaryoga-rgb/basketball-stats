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

// 運営者・チーム関係者向けの試合スコアシート(JBA/FIBAの記録形式を参考にした
// BASKETBALL STATS独自のデジタル帳票)。閲覧のみ(Read Only)。
// 現状はTokyo Comets(検証チーム)限定で有効化している(scoreSheetConfig.js参照)。
// 通常画面はレスポンシブ表示、印刷時のみA4帳票レイアウトに切り替わる(ScoreSheet.css参照)。

function formatQuarterHeader(period, periodSystem) {
  // periodSystemが4q相当(スクリメージ含む)でperiod>4はOT、2q相当でperiod>3もOT。
  // formatQuarterは既存のクォーター表示ロジックをそのまま再利用する
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

// ファウル・タイムアウトのマス目(pips)表示。JBA公式の「マスをXで消していく」
// 記入方式を、塗り/未塗りの丸で表現する。usedがtotalを超えた場合は「+N」で示す
// (5ファウルで退場となる通常ルールでも、記録上はそれ以上のpfイベントがあり得るため)。
function Pips({ used, total }) {
  const filled = Math.min(used, total)
  const overflow = Math.max(0, used - total)
  return (
    <span className="scoresheet-pips">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < filled ? 'scoresheet-pip scoresheet-pip-filled' : 'scoresheet-pip'} />
      ))}
      {overflow > 0 && <span className="scoresheet-pip-overflow">+{overflow}</span>}
    </span>
  )
}

function TeamRosterTable({ team }) {
  if (team.players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {team.name} の選手名簿はBASKETBALL STATS上で管理されていないため表示できません(対戦相手はチーム名・最終得点のみ記録されます)。
      </p>
    )
  }
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table">
        <thead>
          <tr>
            <th>選手</th>
            <th>No.</th>
            <th>STARTER</th>
            <th>PF</th>
            <th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {team.players.map((p) => (
            <tr key={p.id}>
              <td>
                {p.name}
                {p.isGuest && <span className="ml-1 text-[10px] text-muted-foreground">(ゲスト)</span>}
              </td>
              <td className="tabular-nums">{p.number ?? '—'}</td>
              <td>{p.startedOnCourt ? '○' : ''}</td>
              <td>
                <Pips used={p.stats.pf} total={5} />
              </td>
              <td className="tabular-nums">{p.stats.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamCoachLine({ team }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-xs text-muted-foreground">Coach</span>
        <div>{team.coach ?? '—'}</div>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Asst. Coach</span>
        <div>{team.assistantCoach ?? '—'}</div>
      </div>
    </div>
  )
}

function TeamTimeoutsLine({ team }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-xs text-muted-foreground">Time-outs</span>
      <Pips used={team.timeoutsUsed} total={team.timeoutsTotal} />
      <span className="text-xs text-muted-foreground">
        使用 {team.timeoutsUsed} / 残り {team.timeoutsRemaining}
      </span>
    </div>
  )
}

function TeamFoulsTable({ team, lastPeriod, periodSystem }) {
  if (!team.isSelf) {
    return <p className="text-sm text-muted-foreground">チームファウルの記録はありません(NOT_RECORDED)。</p>
  }
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table">
        <thead>
          <tr>
            <th>クォーター</th>
            {Array.from({ length: lastPeriod }, (_, i) => (
              <th key={i}>{formatQuarterHeader(i + 1, periodSystem)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Team Fouls</td>
            {team.teamFoulsByPeriod.map((f) => (
              <td key={f.period}>
                <Pips used={f.count} total={Math.max(f.count, 4)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// RUNNING SCORE: JBA/FIBA公式の「あらかじめ1,2,3...と昇順に並んだマスへ、
// 得点した選手の背番号を書き込む」ランニングスコア欄(ラダー形式)を再現する。
// 自チーム(Team A)は得点イベントの時系列データがあるため各マスに背番号を記入できるが、
// 相手チーム(Team B)は得点イベント単位のデータが保存されていないため、列は残しつつ
// 中身は常に空欄にする(最終得点はPERIOD SCOREに別途表示)。
function RunningScoreLadder({ scoringEvents, teamA, teamB }) {
  const maxScore = Math.max(teamA.finalScore, teamB.finalScore, 1)
  if (scoringEvents.length === 0 && maxScore <= 1) {
    return <p className="text-sm text-muted-foreground">この試合の得点イベントは記録されていません。</p>
  }

  const eventByTotal = new Map(scoringEvents.map((e) => [e.runningScoreSelf, e]))
  // 各クォーターの最後の得点イベント(そのイベント以降、同じクォーター内に次の得点が無いもの)
  const lastEventIdInPeriod = new Map()
  for (const e of scoringEvents) lastEventIdInPeriod.set(e.period, e.id)
  const lastPeriodEventId = scoringEvents.length > 0 ? scoringEvents[scoringEvents.length - 1].id : null

  const shotClass = (type) => (type === '3PT' ? 'scoresheet-shot-3pt' : type === 'FT' ? 'scoresheet-shot-ft' : '')

  return (
    <>
      <div className="scoresheet-ladder">
        {Array.from({ length: maxScore }, (_, i) => {
          const value = i + 1
          const event = eventByTotal.get(value)
          const isPeriodEnd = event && lastEventIdInPeriod.get(event.period) === event.id
          const isGameEnd = event && event.id === lastPeriodEventId
          const rowClass = isGameEnd
            ? 'scoresheet-ladder-row scoresheet-ladder-row-game-end'
            : isPeriodEnd
              ? 'scoresheet-ladder-row scoresheet-ladder-row-period-end'
              : 'scoresheet-ladder-row'
          return (
            <div key={value} className={rowClass}>
              <span className="scoresheet-ladder-value">{value}</span>
              <span className="scoresheet-ladder-a">
                {event ? <span className={shotClass(event.type)}>{event.playerNumber ?? '?'}</span> : ''}
              </span>
              <span className="scoresheet-ladder-b">—</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        凡例: <span className={shotClass('2PT')}>#</span> 2P成功 ／ <span className={shotClass('3PT')}>#</span> 3P成功(円で囲む) ／{' '}
        <span className={shotClass('FT')}>#</span> FT成功(塗りつぶし)。数字は背番号。B列(相手チーム)は得点イベント単位のデータが保存されていないため常に空欄です。
      </p>
    </>
  )
}

function PeriodScoreTable({ vm }) {
  const { teamA, teamB, game } = vm
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table">
        <thead>
          <tr>
            <th>チーム</th>
            {Array.from({ length: game.lastPeriod }, (_, i) => (
              <th key={i}>{formatQuarterHeader(i + 1, game.periodSystem)}</th>
            ))}
            <th>FINAL</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{teamA.name}</td>
            {teamA.quarterScores.map((s, i) => (
              <td key={i} className="tabular-nums">
                {s}
              </td>
            ))}
            <td className="tabular-nums font-semibold">{teamA.finalScore}</td>
          </tr>
          <tr>
            <td>{teamB.name}</td>
            {Array.from({ length: game.lastPeriod }, (_, i) => (
              <td key={i} className="tabular-nums text-muted-foreground">
                —
              </td>
            ))}
            <td className="tabular-nums font-semibold">{teamB.finalScore}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        相手チームはクォーター別得点の記録が無いため(累計のみ記録)、FINAL列のみ表示しています。
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
          <p className="text-xs text-muted-foreground">BASKETBALL STATS — GAME SCORESHEET</p>
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
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section title={`TEAM A — ${teamA.name}`}>
            <TeamRosterTable team={teamA} />
            <TeamCoachLine team={teamA} />
            <TeamTimeoutsLine team={teamA} />
            <TeamFoulsTable team={teamA} lastPeriod={game.lastPeriod} periodSystem={game.periodSystem} />
          </Section>
          <Section title={`TEAM B — ${teamB.name}`}>
            <TeamRosterTable team={teamB} />
            <TeamCoachLine team={teamB} />
            <TeamTimeoutsLine team={teamB} />
            <TeamFoulsTable team={teamB} lastPeriod={game.lastPeriod} periodSystem={game.periodSystem} />
          </Section>
        </div>

        <Section
          title="RUNNING SCORE"
          note={`${teamA.name}(自チーム)の得点をもとにした昇順ラダー形式です(JBA/FIBA公式スコアシートのランニングスコア欄を参考にしています)。相手チームの得点はイベント単位のデータが保存されていないため、B列は常に空欄です(最終得点はPERIOD SCOREに表示しています)。`}
        >
          <RunningScoreLadder scoringEvents={scoringEvents} teamA={teamA} teamB={teamB} />
        </Section>

        <Section title="PERIOD SCORE">
          <PeriodScoreTable vm={vm} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Winner:</span>
              <span className="font-semibold">
                {result.winner === 'self' ? teamA.name : result.winner === 'opponent' ? teamB.name : result.winner === 'tie' ? '—(同点)' : '未定'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">End Time:</span>
              <span>—</span>
            </div>
          </div>
        </Section>

        <Section title="OFFICIALS" note="担当者名を入力する仕組みが現状のアプリに無いため、全項目未記入です。">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ['Scorer', officials.scorer],
              ['Asst. Scorer', officials.assistantScorer],
              ['Timer', officials.timer],
              ['Shot Clock', officials.shotClockOperator],
              ['Crew Chief', officials.crewChief],
              ['Umpire 1', officials.umpire1],
              ['Umpire 2', officials.umpire2],
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
