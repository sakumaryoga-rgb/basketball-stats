import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { buildScoreSheetViewModel, ScoreSheetAccessError } from '@/lib/scoreSheet/buildScoreSheetViewModel'
import {
  formatQuarterHeader,
  FOUL_BOX_COUNT,
  MIN_BLANK_ROSTER_ROWS,
  LADDER_BLOCK_SIZE,
  groupPeriodsForFoulGrid,
  periodEndMap,
  ladderMarkType,
} from '@/lib/scoreSheet/scoreSheetLayout'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreSheetPrint } from './ScoreSheetPrint'
import './ScoreSheet.css'

// 運営者・チーム関係者向けの試合スコアシート(JBA/FIBAの記録形式、および実際に
// 現場で使われている非公式スコアシート様式を参考にしたBASKETBALL STATS独自の
// デジタル帳票)。閲覧のみ(Read Only)。Tokyo Comets限定のテスト運用を経て、
// 全チームで利用可能にしている。
//
// 画面表示(このファイル)と印刷/PDF出力(ScoreSheetPrint.jsx)は、同じ
// ScoreSheetViewModelを使う完全に別々のコンポーネント・CSSに分離している。
// 以前は1つのレスポンシブDOMを@media printで大量に上書きしていたが、
// Tailwindのsm:/md:等のレスポンシブクラスは「そのDOMが置かれた要素の幅」ではなく
// 「viewport(印刷時はpage box)の幅」を基準に評価されるため、印刷を実行した
// 端末によって適用されるクラスが変わり得る(モバイルから印刷すると画面表示相当の
// 狭いレイアウトのまま出力される)という問題があった。ScoreSheetPrint.jsxは
// Tailwindのレスポンシブユーティリティを一切使わず、列数・幅を全て固定値
// (%/mm/pt)で明示することで、印刷を実行した端末に関わらず常に同一のA4帳票に
// なるようにしている。

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

function TeamRosterTable({ team, periodSystem, blankRowCount }) {
  const rows = team.players.length > 0 ? team.players : Array.from({ length: Math.max(blankRowCount, MIN_BLANK_ROSTER_ROWS) })
  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="scoresheet-table scoresheet-roster-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>選手氏名</th>
            <th>#</th>
            <th>STARTER</th>
            <th colSpan={FOUL_BOX_COUNT}>ファウル</th>
            <th>PTS</th>
          </tr>
          <tr>
            <th colSpan={4}></th>
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

// RUNNING SCORE: A得点者|A累計得点|B累計得点|B得点者の4列構成(JBA/FIBA公式
// スコアシートの様式)。Team A/Bそれぞれが独立した累計得点列を持ち、1ブロック
// 40点分を1単位として両チームの到達点数に応じて必要なブロック数だけ表示する。
// 2P/3P成功は自チームの累計得点セルに斜線、FT成功は黒丸で塗って示す。
// 自チーム(A)は得点イベントに選手の背番号が紐づくため、3P成功時のみ背番号を
// 丸で囲む。相手チーム(B)は選手名簿を持たないため番号を記入せず、累計得点
// セルのマークのみで示す。
function shotClass(type) {
  return type === '3PT' ? 'scoresheet-shot-3pt' : ''
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
              <th colSpan={2}>A</th>
              <th colSpan={2}>B</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LADDER_BLOCK_SIZE }, (_, i) => {
              const value = start + i
              const eventA = eventByTotalA.get(value)
              const eventB = eventByTotalB.get(value)
              // クォーター終了時点/試合終了時点の区切り線は、得点者セル・累計点セルの
              // 両方に同じクラスを適用する(その行の「A側」または「B側」全体を
              // 太線/二重線で区切る)。
              const cellClassA = eventA && eventA.id === lastGameA ? 'scoresheet-ladder-game-end' : eventA && lastA.get(eventA.period) === eventA.id ? 'scoresheet-ladder-period-end' : ''
              const cellClassB = eventB && eventB.id === lastGameB ? 'scoresheet-ladder-game-end' : eventB && lastB.get(eventB.period) === eventB.id ? 'scoresheet-ladder-period-end' : ''
              const markA = ladderMarkType(eventA)
              const markB = ladderMarkType(eventB)
              const valueClassA = ['scoresheet-ladder-value', 'tabular-nums', markA && `scoresheet-ladder-value-${markA}`, cellClassA].filter(Boolean).join(' ')
              const valueClassB = ['scoresheet-ladder-value', 'tabular-nums', markB && `scoresheet-ladder-value-${markB}`, cellClassB].filter(Boolean).join(' ')
              return (
                <tr key={value}>
                  <td className={`scoresheet-ladder-a ${cellClassA}`}>
                    {eventA ? <span className={shotClass(eventA.type)}>{eventA.playerLabel}</span> : ''}
                  </td>
                  <td className={valueClassA}>{value}</td>
                  <td className={valueClassB}>{value}</td>
                  {/* 相手チームは選手番号を保持していないため(NOT_RECORDED)、
                      推測で番号や記号を書き込まない。得点種別は隣の累計点セルの
                      マーク(斜線/黒丸塗り)で表現済み。 */}
                  <td className={`scoresheet-ladder-b ${cellClassB}`}></td>
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
      <div className="scoresheet-team-meta-row">
        <TeamTimeoutsLine team={team} />
        <TeamFoulsGrid team={team} lastPeriod={game.lastPeriod} periodSystem={game.periodSystem} />
      </div>
      <TeamRosterTable team={team} periodSystem={game.periodSystem} blankRowCount={game.teamAPlayerCount} />
      <TeamCoachLine team={team} />
    </Section>
  )
}

export function ScoreSheet() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | ready | not-found | unsupported-game-type | error
  const [vm, setVm] = useState(null)
  // window.print()は「印刷 / PDF保存」ボタンのクリック(=ユーザー操作)からのみ呼び出す。
  // useEffect・route遷移・タイマー・クエリパラメータ等から自動実行することは無い。
  // このrefは、印刷ダイアログが開いている間の二重発火(連打等)でwindow.print()が
  // 複数回呼ばれるのを防ぐガード。afterprintイベント(印刷ダイアログが閉じた
  // タイミングで発火)を検知できたらそこで解除する。iOS SafariはAirPrintの
  // 共有シート経由になる関係でafterprintの発火が不安定なことがあるため、
  // 発火しなかった場合に備えてフォールバックのタイムアウトも用意し、
  // ボタンが永久に押せなくなることは無いようにする。
  const printingRef = useRef(false)
  const printingFallbackTimeoutRef = useRef(null)
  // ブラウザの「PDFに保存」は既定でdocument.titleをファイル名候補にするため、
  // 印刷直前だけ「vs対戦相手名_試合日」に変更し、印刷完了後に元のタイトル
  // (アプリ起動時のもの)へ戻す。
  const originalTitleRef = useRef(document.title)

  useEffect(() => {
    function handleAfterPrint() {
      printingRef.current = false
      document.title = originalTitleRef.current
      if (printingFallbackTimeoutRef.current) {
        clearTimeout(printingFallbackTimeoutRef.current)
        printingFallbackTimeoutRef.current = null
      }
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      if (printingFallbackTimeoutRef.current) clearTimeout(printingFallbackTimeoutRef.current)
      // 印刷ダイアログが開いたまま画面を離れた場合でも、タイトルを変更したままに
      // しない(戻る操作等でこのコンポーネント自体がアンマウントされるケース)
      document.title = originalTitleRef.current
    }
  }, [])

  const handlePrintClick = () => {
    if (printingRef.current || !vm) return
    printingRef.current = true
    // ファイル名として使えない記号(/ \ : * ? " < > |)は除去する
    const opponent = (vm.teamB.name || '').replace(/[\\/:*?"<>|]/g, '').trim()
    document.title = `vs${opponent}_${vm.game.date}`
    window.print()
    // afterprintがどうしても発火しない環境へのフォールバックのみ。
    // afterprintが先に発火した場合はこのタイマー自体をクリアする。
    printingFallbackTimeoutRef.current = setTimeout(() => {
      printingRef.current = false
      document.title = originalTitleRef.current
      printingFallbackTimeoutRef.current = null
    }, 10000)
  }

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
      {/* 画面表示用のレスポンシブDOM。印刷時はscoresheet-screen-onlyにより非表示にし、
          代わりにScoreSheetPrint(Tailwindのレスポンシブクラスを一切使わない、
          A4固定レイアウト専用の完全に独立したコンポーネント)を印刷する。 */}
      <div className="scoresheet-container scoresheet-screen-only">
        <div className="no-print flex items-center justify-between pt-[env(safe-area-inset-top)]">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="size-4" />
            戻る
          </button>
          <Button size="sm" onClick={handlePrintClick}>
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
          <div className="scoresheet-info-grid grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
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
          <div className="scoresheet-officials-grid grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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

      <ScoreSheetPrint vm={vm} />
    </div>
  )
}
