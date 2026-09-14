import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// 運営者専用のRead Only管理ダッシュボード。一般ユーザーの匿名認証・チームセッションとは
// 完全に分離しており、認証は/api/admin/loginが発行する署名付きセッションCookieのみで行う。
// 削除・Ban・権限変更等の操作機能は無い(閲覧専用)。グラフはRechartsを本画面でのみ使用する。

const CHART_HEIGHT = 220
const CHART_COLORS = {
  primary: 'var(--chart-1)',
  secondary: 'var(--chart-2)',
  tertiary: 'var(--chart-3)',
}
const GAME_TYPE_LABEL = { official: '試合', practice: '練習', shooting: 'シューティング' }
const AXIS_TICK = { fontSize: 11 }
// グラフの棒が疎らなデータ点でもカード幅いっぱいまで太くならないようにする上限(px)
const MAX_BAR_SIZE = 45

// 対応する期間はこの5種類のみ(自由な日付範囲指定は行わない)
const PERIODS = [
  { key: '30d', label: '30日' },
  { key: '90d', label: '90日' },
  { key: '1y', label: '1年' },
  { key: '3y', label: '3年' },
  { key: '5y', label: '5年' },
]

function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('ja-JP')
}

// 粒度に応じてX軸・Tooltipのラベルを短く整形する(day/week: M/D, month: YYYY/MM, quarter: YYYY Qn)
function formatBucketLabel(bucket, granularity) {
  if (!bucket) return ''
  const d = new Date(`${bucket}T00:00:00`)
  if (Number.isNaN(d.getTime())) return bucket
  if (granularity === 'month') return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
  if (granularity === 'quarter') return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// current/previousの両方が揃っている時だけ%を計算する。previousが0またはnull/undefinedの
// 場合は「比較データなし」とし、0%として扱わない
function computeDelta(current, previous) {
  if (current === null || current === undefined) return null
  if (previous === null || previous === undefined || previous === 0) return null
  return ((current - previous) / previous) * 100
}

function DeltaBadge({ current, previous, label }) {
  const delta = computeDelta(current, previous)
  if (delta === null) {
    return <span className="text-xs text-muted-foreground">比較データなし</span>
  }
  const up = delta >= 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
      {up ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% {label}
    </span>
  )
}

function KpiCard({ label, value, emphasize, delta }) {
  return (
    <Card className={emphasize ? 'ring-2 ring-primary' : undefined}>
      <CardContent className="flex flex-col gap-1 py-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={emphasize ? 'text-4xl font-heading tabular-nums' : 'text-2xl font-heading tabular-nums'}>
          {formatNumber(value)}
        </span>
        {delta && <DeltaBadge current={delta.current} previous={delta.previous} label={delta.label} />}
      </CardContent>
    </Card>
  )
}

function SectionCard({ title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

function EmptyChart({ message = 'この期間のデータはありません' }) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: CHART_HEIGHT }}>
      {message}
    </div>
  )
}

function PeriodSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            value === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function ActiveUsersLineChart({ data, granularity }) {
  if (!data || data.length === 0) return <EmptyChart />
  const tickFormatter = (v) => formatBucketLabel(v, granularity)
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS_TICK} tickFormatter={tickFormatter} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
        <Tooltip formatter={(v) => [v, 'DAU']} labelFormatter={tickFormatter} />
        <Line
          type="monotone"
          dataKey="count"
          name="DAU"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function PageViewsBarChart({ data, granularity }) {
  if (!data || data.length === 0) return <EmptyChart />
  const tickFormatter = (v) => formatBucketLabel(v, granularity)
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS_TICK} tickFormatter={tickFormatter} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
        <Tooltip formatter={(v) => [v, 'PV']} labelFormatter={tickFormatter} />
        <Bar dataKey="count" name="PV" fill={CHART_COLORS.primary} radius={[2, 2, 0, 0]} maxBarSize={MAX_BAR_SIZE} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function pivotGamesByType(rows) {
  if (!rows || rows.length === 0) return []
  const byBucket = {}
  for (const row of rows) {
    if (!byBucket[row.bucket]) byBucket[row.bucket] = { bucket: row.bucket, official: 0, practice: 0, shooting: 0 }
    byBucket[row.bucket][row.game_type] = row.count
  }
  return Object.values(byBucket).sort((a, b) => a.bucket.localeCompare(b.bucket))
}

function GamesByTypeStackedChart({ rows, granularity }) {
  const data = pivotGamesByType(rows)
  if (data.length === 0) return <EmptyChart />
  const tickFormatter = (v) => formatBucketLabel(v, granularity)
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS_TICK} tickFormatter={tickFormatter} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
        <Tooltip labelFormatter={tickFormatter} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="official" stackId="a" name={GAME_TYPE_LABEL.official} fill={CHART_COLORS.primary} maxBarSize={MAX_BAR_SIZE} />
        <Bar dataKey="practice" stackId="a" name={GAME_TYPE_LABEL.practice} fill={CHART_COLORS.secondary} maxBarSize={MAX_BAR_SIZE} />
        <Bar
          dataKey="shooting"
          stackId="a"
          name={GAME_TYPE_LABEL.shooting}
          fill={CHART_COLORS.tertiary}
          radius={[2, 2, 0, 0]}
          maxBarSize={MAX_BAR_SIZE}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

function TopPagesBarChart({ rows }) {
  const data = (rows || []).slice(0, 5)
  if (data.length === 0) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
        <YAxis type="category" dataKey="path" tick={AXIS_TICK} width={130} />
        <Tooltip formatter={(v) => [v, 'PV']} />
        <Bar dataKey="count" name="PV" fill={CHART_COLORS.primary} radius={[0, 2, 2, 0]} maxBarSize={MAX_BAR_SIZE} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function LoginForm({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 429) {
        setError('試行回数が上限に達しました。しばらく時間を置いてから再度お試しください。')
        return
      }
      if (!res.ok) {
        setError('パスワードが正しくありません。')
        return
      }
      onSuccess()
    } catch {
      setError('ログインに失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>管理ダッシュボード</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-password">パスワード</Label>
              <Input
                id="admin-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting || !password}>
              {submitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminDashboard() {
  const [status, setStatus] = useState('loading') // loading | needs-login | ready | error
  const [data, setData] = useState(null)
  const [period, setPeriod] = useState('30d')
  const [series, setSeries] = useState(null)
  const [seriesLoading, setSeriesLoading] = useState(false)

  async function loadDashboard() {
    setStatus('loading')
    try {
      const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
      if (res.status === 401) {
        setStatus('needs-login')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      setData(await res.json())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  // 期間切り替え時はグラフ用データだけを再取得する(ページ全体のリロード・
  // KPI/問い合わせ/運用確認の再取得はしない)
  async function loadSeries(selectedPeriod) {
    setSeriesLoading(true)
    try {
      const res = await fetch(`/api/admin/series?period=${selectedPeriod}`, { credentials: 'include' })
      if (res.ok) setSeries(await res.json())
    } catch {
      // グラフ取得失敗時は直前のseriesを保持し、各チャートは空データ扱いで表示を続ける
    } finally {
      setSeriesLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  useEffect(() => {
    if (status === 'ready') loadSeries(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, period])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    setData(null)
    setSeries(null)
    setStatus('needs-login')
  }

  if (status === 'loading') {
    return <div className="min-h-svh flex items-center justify-center text-muted-foreground">読み込み中...</div>
  }
  if (status === 'needs-login') {
    return <LoginForm onSuccess={loadDashboard} />
  }
  if (status === 'error' || !data) {
    return (
      <div className="min-h-svh flex items-center justify-center text-destructive">
        ダッシュボードの取得に失敗しました
      </div>
    )
  }

  const { usage, content, contact, ops } = data

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading tracking-wide">管理ダッシュボード</h1>
        <Button variant="outline" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      {/* 上段: 主要KPI(広告・スポンサー提案用) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard
          label="MAU(当月)"
          value={usage.mau}
          emphasize
          delta={{ current: usage.mau, previous: usage.mauPrev, label: '前月比' }}
        />
        <KpiCard
          label="月間PV"
          value={usage.pvMonth}
          delta={{ current: usage.pvMonth, previous: usage.pvMonthPrev, label: '前月比' }}
        />
        <KpiCard label="チーム参加ユーザー数" value={usage.teamMemberUserCount} />
        <KpiCard label="総チーム数" value={usage.totalTeams} />
        <KpiCard
          label="アクティブチーム数(30日)"
          value={usage.activeTeams30d}
          delta={{ current: usage.activeTeams30d, previous: usage.activeTeams30dPrev, label: '前30日比' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="DAU(本日)" value={usage.dau} />
        <KpiCard label="WAU(直近7日)" value={usage.wau} />
        <KpiCard label="PV総数 / 直近7日" value={usage.pvTotal} />
      </div>

      {/* 利用推移: 期間切り替え(30日/90日/1年/3年/5年)は以下4つのグラフに共通で効く */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading tracking-wide">利用推移</h2>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        <div
          className={`grid grid-cols-1 gap-3 md:grid-cols-2 transition-opacity ${seriesLoading ? 'opacity-60' : ''}`}
        >
          <SectionCard title="アクティブユーザー推移">
            <ActiveUsersLineChart data={series?.activeUsers} granularity={series?.granularity} />
          </SectionCard>
          <SectionCard title="PV推移">
            <PageViewsBarChart data={series?.pageViews} granularity={series?.granularity} />
          </SectionCard>
        </div>

        <div
          className={`grid grid-cols-1 gap-3 md:grid-cols-2 transition-opacity ${seriesLoading ? 'opacity-60' : ''}`}
        >
          <SectionCard title="試合 / 練習 / シューティング推移">
            <GamesByTypeStackedChart rows={series?.gamesByType} granularity={series?.granularity} />
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">試合数(累計)</div>
                <div className="text-xl tabular-nums">{formatNumber(content.officialGames)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">練習数(累計)</div>
                <div className="text-xl tabular-nums">{formatNumber(content.practiceGames)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">シューティング記録数(累計)</div>
                <div className="text-xl tabular-nums">{formatNumber(content.shootingGames)}</div>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="ページ別PV TOP5">
            <TopPagesBarChart rows={series?.pvByPage} />
          </SectionCard>
        </div>
      </div>

      {/* さらに下: 問い合わせ・最近作成されたチーム・スパム兆候・Storage/Error */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard title="お問い合わせ">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">総数</div>
              <div className="text-xl tabular-nums">{formatNumber(contact.total)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">AI分類件数</div>
              <div className="text-xl tabular-nums">{formatNumber(contact.aiClassified)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">レート制限件数</div>
              <div className="text-xl tabular-nums">{formatNumber(contact.rateLimited)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">未対応件数</div>
              <div className="text-xl tabular-nums">{formatNumber(contact.unhandled)}</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">種別内訳</div>
            <div className="flex flex-col gap-1 text-sm">
              {Object.entries(contact.byType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{type}</span>
                  <span className="tabular-nums">{formatNumber(count)}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="最近作成されたチーム">
          <div className="flex flex-col gap-1.5 text-sm">
            {(ops.recentTeams || []).map((team) => (
              <div key={team.id} className="flex items-center justify-between">
                <span>{team.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(team.created_at).toLocaleDateString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SectionCard title="スパム兆候">
          {ops.spam ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span>直近1時間のチーム作成数</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatNumber(ops.spam.teamsCreatedLastHour)}</span>
                  {ops.spam.teamsCreatedLastHourFlag && <Badge variant="destructive">要確認</Badge>}
                </span>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">多数チームに所属しているユーザー</div>
                {ops.spam.usersWithManyTeams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">特に異常なし</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {ops.spam.usersWithManyTeams.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between text-xs">
                        <span className="truncate text-muted-foreground">{u.userId}</span>
                        <span className="tabular-nums">{u.teamCount}チーム</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">取得できませんでした</p>
          )}
        </SectionCard>

        <SectionCard title="Storage / Error">
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Storage使用量</div>
              {(ops.storageUsage || []).map((row) => (
                <div key={row.bucket_id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{row.bucket_id}</span>
                  <span className="tabular-nums">
                    {(row.total_bytes / (1024 * 1024)).toFixed(1)}MB ({formatNumber(row.object_count)}件)
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">クライアントエラー件数</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">総数 / 直近7日 / 直近30日</span>
                <span className="tabular-nums">
                  {formatNumber(ops.errors?.total)} / {formatNumber(ops.errors?.last7d)} /{' '}
                  {formatNumber(ops.errors?.last30d)}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <p className="text-xs text-muted-foreground">最終更新: {new Date(data.generatedAt).toLocaleString('ja-JP')}</p>
    </div>
  )
}
