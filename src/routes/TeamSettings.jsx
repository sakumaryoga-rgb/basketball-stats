import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Copy,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  RefreshCw,
  LogOut,
  Trash2,
  KeyRound,
  ShieldCheck,
  UserX,
  ArrowRightLeft,
} from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { usePlayers } from '@/hooks/usePlayers'
import { useGames } from '@/hooks/useGames'
import { useTeamSeasonStats } from '@/hooks/useTeamSeasonStats'
import { useShotChart } from '@/hooks/useShotChart'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { uploadTeamIcon } from '@/lib/uploadTeamIcon'
import { formatAvg, formatPct, formatPositions, pct, perGame, POSITIONS } from '@/lib/stats'
import { deviceCategoryLabel } from '@/lib/team'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { HotZoneSection } from '@/components/HotZoneSection'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

function EditTeamDialog({ team, onTeamUpdated, children }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(team.icon_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleOpenChange(next) {
    if (next) {
      setName(team.name)
      setIconFile(null)
      setIconPreview(team.icon_url ?? '')
      setError('')
    }
    setOpen(next)
  }

  function handleIconChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setIconFile(file)
    setIconPreview(URL.createObjectURL(file))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      let iconUrl = team.icon_url ?? null
      if (iconFile) {
        iconUrl = await uploadTeamIcon(team.id, iconFile)
      }
      const { error: updateError } = await supabase
        .from('teams')
        .update({ name, icon_url: iconUrl })
        .eq('id', team.id)
      if (updateError) throw updateError
      await onTeamUpdated()
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTeam() {
    setDeleting(true)
    const { error: deleteError } = await supabase.from('teams').delete().eq('id', team.id)
    setDeleting(false)
    if (deleteError) {
      console.error('チームの削除に失敗しました', deleteError)
      return
    }
    setConfirmDelete(false)
    setOpen(false)
    await onTeamUpdated()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>チームプロフィールを編集</DialogTitle>
          <DialogDescription>チーム名とアイコンを更新します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Avatar size="lg" className="size-16">
              <AvatarImage src={iconPreview} alt={name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {name?.[0] ?? 'B'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="team-icon">アイコン</Label>
              <Input id="team-icon" type="file" accept="image/*" onChange={handleIconChange} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-name-edit">チーム名</Label>
            <Input id="team-name-edit" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存する'}
            </Button>
          </DialogFooter>
        </form>
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            このチームを削除する
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{team.name}」を削除します。選手・試合・スタッツの記録もすべて削除され、元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteTeam}>
              {deleting ? '削除中...' : '削除する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function formatGrantedUntil(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (date <= new Date()) return null
  return date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const GRANT_HOUR_OPTIONS = [
  { hours: 3, label: '3時間' },
  { hours: 24, label: '24時間' },
  { hours: 24 * 7, label: '1週間' },
]

function GrantRecordingDialog({ team, member, onGranted }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleGrant(hours) {
    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('grant_recording_permission', {
      p_team_id: team.id,
      p_member_id: member.id,
      p_hours: hours,
    })
    setSaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setOpen(false)
    await onGranted()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>記録権限を付与</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>記録権限を付与</DialogTitle>
          <DialogDescription>この端末に試合・スタッツの記録権限を一時的に付与します。期間を選んでください。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {GRANT_HOUR_OPTIONS.map((opt) => (
            <Button
              key={opt.hours}
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => handleGrant(opt.hours)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

// メンバー(端末)1件の表示・管理者用の操作(記録権限の付与/取消・管理者交代・アクセス削除)。
// 「アクセスを削除」はteam_membersの行を消すだけで、players/games等の共有データや
// 個人情報そのものを削除するものではない(法的な削除依頼は運営者の窓口へ案内する)。
function MemberRow({ team, member, isSelf, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const grantedUntilLabel = formatGrantedUntil(member.recording_granted_until)
  const isAdmin = member.role === 'admin'

  async function handleRevoke() {
    setBusy(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('revoke_recording_permission', {
      p_team_id: team.id,
      p_member_id: member.id,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onRefresh()
  }

  async function handleTransfer() {
    setBusy(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('transfer_admin', {
      p_team_id: team.id,
      p_new_admin_member_id: member.id,
    })
    setBusy(false)
    setConfirmTransfer(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onRefresh()
  }

  async function handleRemove() {
    setBusy(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('remove_team_member', {
      p_team_id: team.id,
      p_member_id: member.id,
    })
    setBusy(false)
    setConfirmRemove(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    await onRefresh()
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">
          {deviceCategoryLabel(member.device_category)}
          {isSelf && <span className="text-muted-foreground font-normal"> (この端末)</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && (
            <Badge variant="secondary">
              <ShieldCheck className="size-3" />
              管理者
            </Badge>
          )}
          {grantedUntilLabel && <Badge variant="outline">記録権限 〜{grantedUntilLabel}</Badge>}
        </div>
      </div>

      {team.myRole === 'admin' && !isAdmin && (
        <div className="flex flex-wrap gap-1.5">
          {grantedUntilLabel ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRevoke}>
              記録権限を取り消す
            </Button>
          ) : (
            <GrantRecordingDialog team={team} member={member} onGranted={onRefresh} />
          )}
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmTransfer(true)}>
            <ArrowRightLeft className="size-3.5" />
            管理者にする
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
          >
            <UserX className="size-3.5" />
            アクセスを削除
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      <AlertDialog open={confirmTransfer} onOpenChange={setConfirmTransfer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>管理者を交代しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この端末を新しい管理者にします。あなた自身は一般メンバーになります(チームには残ります)。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button disabled={busy} onClick={handleTransfer}>
              {busy ? '処理中...' : '管理者にする'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このメンバーのアクセスを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              この端末からチームへのアクセス権のみを削除します(選手・試合・スタッツ等のチームデータは削除されません)。
              なお、この操作は個人情報の削除依頼とは異なります。個人情報の削除をご希望の場合は、運営者への「お問い合わせ」からご連絡いただくようお伝えください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={busy} onClick={handleRemove}>
              {busy ? '削除中...' : '削除する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

// 管理者復旧コードの(再)発行。平文はこの発行直後の一度しか表示できない(以降はハッシュのみ保存される)。
function RecoveryCodeSection({ team }) {
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [plainCode, setPlainCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('generate_admin_recovery_code', { p_team_id: team.id })
    setGenerating(false)
    setConfirmGenerate(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setPlainCode(data)
    setShowCode(true)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(plainCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border-t pt-4 flex flex-col gap-2">
      <p className="text-xs text-muted-foreground leading-relaxed">
        管理者復旧コードは、この端末のデータが消えた場合などに、別の端末から招待コードとあわせて入力することで管理者として復旧するためのコードです。発行すると、それ以前に発行したコードは無効になります。
      </p>
      <Button type="button" variant="outline" onClick={() => setConfirmGenerate(true)}>
        <KeyRound className="size-4" />
        管理者復旧コードを発行する
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}

      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>復旧コードを発行しますか?</AlertDialogTitle>
            <AlertDialogDescription>新しい復旧コードが発行され、以前発行したコードは使えなくなります。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button disabled={generating} onClick={handleGenerate}>
              {generating ? '発行中...' : '発行する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCode} onOpenChange={setShowCode}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>管理者復旧コード</AlertDialogTitle>
            <AlertDialogDescription>この画面を閉じると二度と表示されません。安全な場所に控えてください。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-base font-bold tabular-nums tracking-widest text-center bg-muted rounded-md px-3 py-3 break-all">
            {plainCode}
          </div>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'コピーしました' : 'コピー'}
            </Button>
            <AlertDialogClose render={<Button />}>閉じる</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MembersCard({ team, members, onRefresh }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>MEMBERS</CardTitle>
        <CardDescription>チームに参加している端末の一覧です。役割・記録権限を管理できます。</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberRow key={m.id} team={team} member={m} isSelf={m.id === team.myMembershipId} onRefresh={onRefresh} />
          ))}
        </ul>
        {team.myRole === 'admin' && <RecoveryCodeSection team={team} />}
      </CardContent>
    </Card>
  )
}

// admin自身がチームを退出する場合、管理者不在を防ぐため必ず他のメンバーへ移譲してから退出する
// (transfer_admin_and_leaveはアトミックなので、管理者不在の状態が生じることはない)
function TransferAndLeaveDialog({ team, otherMembers, onLeft }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState('')

  function handleOpenChange(next) {
    if (next) {
      setSelectedId('')
      setError('')
    }
    setOpen(next)
  }

  async function handleConfirm() {
    if (!selectedId) return
    setLeaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('transfer_admin_and_leave', {
      p_team_id: team.id,
      p_new_admin_member_id: selectedId,
    })
    setLeaving(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setOpen(false)
    await onLeft()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="ghost" className="text-destructive hover:text-destructive" />}>
        <LogOut className="size-4" />
        このチームを退出する
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理者を移譲してから退出</DialogTitle>
          <DialogDescription>
            あなたはこのチームの管理者です。退出する前に、他のメンバーの中から新しい管理者を選んでください。
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {otherMembers.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  selectedId === m.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
              >
                <span>{deviceCategoryLabel(m.device_category)}</span>
                {selectedId === m.id && <Check className="size-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
          <Button variant="destructive" disabled={!selectedId || leaving} onClick={handleConfirm}>
            {leaving ? '処理中...' : '管理者を移譲して退出する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatBlock({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function TeamSettings({ team, teams = [], onSwitchTeam, onTeamUpdated }) {
  const navigate = useNavigate()
  const { players: allPlayers, updatePlayer } = usePlayers(team.id)
  const players = allPlayers.filter((p) => !p.guest_game_id)
  const { games } = useGames(team.id)
  const { totals } = useTeamSeasonStats(team.id)
  const { shots } = useShotChart(team.id)
  const { members, refresh: refreshMembers } = useTeamMembers(team.id)
  const otherMembers = members.filter((m) => m.id !== team.myMembershipId)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const inviteUrl = `${window.location.origin}/onboarding?code=${team.invite_code}`

  const gamesPlayed = games.filter((g) => g.status !== 'scheduled').length
  const startersCount = players.filter((p) => p.is_starter).length

  // 第一ポジション(PG→SG→SF→PF→C、未設定は最後)ごとにグループ分けする。
  // 各グループ内は元の並び順(sort_order/背番号)を保つ。
  const UNSET_POSITION = '未設定'
  const rosterGroups = useMemo(() => {
    const buckets = new Map([...POSITIONS, UNSET_POSITION].map((key) => [key, []]))
    for (const p of players) {
      const key = POSITIONS.includes(p.position) ? p.position : UNSET_POSITION
      buckets.get(key).push(p)
    }
    return [...POSITIONS, UNSET_POSITION]
      .map((key) => ({ key, players: buckets.get(key) }))
      .filter((g) => g.players.length > 0)
  }, [players])

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const averages = useMemo(() => {
    if (!totals) return null
    return {
      pts: perGame(totals.pts, gamesPlayed),
      reb: perGame(totals.reb, gamesPlayed),
      ast: perGame(totals.ast, gamesPlayed),
      stl: perGame(totals.stl, gamesPlayed),
      blk: perGame(totals.blk, gamesPlayed),
      tov: perGame(totals.tov, gamesPlayed),
      fgPct: pct(totals.fgm, totals.fga),
      tpPct: pct(totals.tpm, totals.tpa),
      ftPct: pct(totals.ftm, totals.fta),
    }
  }, [totals, gamesPlayed])

  async function handleCopyUrl() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(team.invite_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  async function handleRegenerateCode() {
    setRegenerating(true)
    const newCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
    const { error } = await supabase.from('teams').update({ invite_code: newCode }).eq('id', team.id)
    setRegenerating(false)
    setConfirmRegenerate(false)
    if (error) {
      console.error('招待コードの再発行に失敗しました', error)
      return
    }
    await onTeamUpdated()
  }

  // 一般メンバーの退出。管理者の行はRLSで削除できないため、admin判定はこの関数を
  // 呼び出す前(JSXの分岐)で行っている。
  async function handleLeaveTeam() {
    setLeaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', team.id)
      .eq('user_id', userData?.user?.id)
    setLeaving(false)
    if (error) {
      console.error('チームの退出に失敗しました', error)
      return
    }
    setConfirmLeave(false)
    await onTeamUpdated()
    navigate('/onboarding')
  }

  async function handleMembersRefresh() {
    await refreshMembers()
    await onTeamUpdated()
  }

  async function handleAdminLeft() {
    await onTeamUpdated()
    navigate('/onboarding')
  }

  async function handleToggleStarter(player) {
    if (!player.is_starter && startersCount >= 5) return
    await updatePlayer(player.id, { is_starter: !player.is_starter })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-heading tracking-wide">TEAM</h1>

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            <AvatarImage src={team.icon_url} alt={team.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
              {team.name?.[0] ?? 'B'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-medium truncate">{team.name}</p>
            <p className="text-xs text-muted-foreground">{players.length}人の選手が所属</p>
          </div>
          <EditTeamDialog team={team} onTeamUpdated={onTeamUpdated}>
            <Button variant="outline" size="icon-sm" aria-label="編集">
              <Pencil className="size-4" />
            </Button>
          </EditTeamDialog>
        </CardContent>
      </Card>

      <MembersCard team={team} members={members} onRefresh={handleMembersRefresh} />

      <Card>
        <CardHeader>
          <CardTitle>ROSTER</CardTitle>
          <CardDescription>
            STARTING FIVE(試合追加時のデフォルト) ・ {startersCount}/5人選択中
          </CardDescription>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">まだ選手が登録されていません</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rosterGroups.map(({ key, players: groupPlayers }) => {
                const open = !!openGroups[key]
                return (
                  <div key={key}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(key)}
                      className="flex w-full items-center justify-between rounded-lg -mx-2 px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <span>
                        {key} ({groupPlayers.length}人)
                      </span>
                      <ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} />
                    </button>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-in-out',
                        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <ul className="flex flex-col gap-2 pt-2 pb-1">
                          {groupPlayers.map((p) => (
                            <li
                              key={p.id}
                              className={cn(
                                'flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-lg transition-colors duration-300',
                                p.is_starter && 'bg-primary/5'
                              )}
                            >
                              <Link
                                to={`/players/${p.id}`}
                                className="flex flex-1 min-w-0 items-center gap-3 rounded-lg hover:bg-muted/50"
                              >
                                <Avatar className="size-8 shrink-0 text-xs font-medium">
                                  <AvatarImage src={p.photo_url} alt={p.name} />
                                  <AvatarFallback className="tabular-nums">{p.number ?? '-'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{p.name}</p>
                                  {p.position && (
                                    <p className="text-xs text-muted-foreground">{formatPositions(p.position, p.position2)}</p>
                                  )}
                                </div>
                              </Link>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground">STARTING FIVE</span>
                                <Switch
                                  checked={p.is_starter}
                                  onCheckedChange={() => handleToggleStarter(p)}
                                  disabled={!p.is_starter && startersCount >= 5}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {gamesPlayed > 0 && totals && (
        <>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">チーム1試合平均 ({gamesPlayed}試合)</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PPG" value={formatAvg(averages.pts)} />
              <StatBlock label="RPG" value={formatAvg(averages.reb)} />
              <StatBlock label="APG" value={formatAvg(averages.ast)} />
              <StatBlock label="SPG" value={formatAvg(averages.stl)} />
              <StatBlock label="BPG" value={formatAvg(averages.blk)} />
              <StatBlock label="TOPG" value={formatAvg(averages.tov)} />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">チームシュート成功率</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="FG%" value={formatPct(averages.fgPct)} />
              <StatBlock label="3P%" value={formatPct(averages.tpPct)} />
              <StatBlock label="FT%" value={formatPct(averages.ftPct)} />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground mb-3">チームシーズン合計</p>
            <div className="grid grid-cols-3 gap-y-4">
              <StatBlock label="PTS" value={totals.pts} />
              <StatBlock label="REB" value={totals.reb} />
              <StatBlock label="AST" value={totals.ast} />
              <StatBlock label="STL" value={totals.stl} />
              <StatBlock label="BLK" value={totals.blk} />
              <StatBlock label="TO" value={totals.tov} />
            </div>
          </div>
        </>
      )}

      <HotZoneSection shots={shots} />

      <Card>
        <CardHeader>
          <CardTitle>INVITATION</CardTitle>
          <CardDescription>このURLまたはコードを共有すると、フレンドがチームに参加できます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>招待URL</Label>
            <div className="text-sm bg-muted rounded-md px-3 py-2 break-all">{inviteUrl}</div>
            <Button variant="outline" onClick={handleCopyUrl}>
              {copiedUrl ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiedUrl ? 'コピーしました' : 'URLをコピー'}
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>招待コード</Label>
            <div className="text-lg font-bold tabular-nums tracking-[0.2em] text-center bg-muted rounded-md px-3 py-2">
              {team.invite_code}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCopyCode}>
                {copiedCode ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiedCode ? 'コピーしました' : 'コードをコピー'}
              </Button>
              <Button variant="outline" size="icon" aria-label="コードを再発行" onClick={() => setConfirmRegenerate(true)}>
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>招待コードを再発行しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              新しいURL・コードが発行され、これまでのものは使えなくなります。すでに共有した相手は参加できなくなります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button disabled={regenerating} onClick={handleRegenerateCode}>
              {regenerating ? '再発行中...' : '再発行する'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>MYTEAM</CardTitle>
          <CardDescription>所属している他のチームに切り替えられます</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => onSwitchTeam(t.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    t.id === team.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <Avatar className="size-8 shrink-0 text-xs font-medium">
                    <AvatarImage src={t.icon_url} alt={t.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{t.name?.[0] ?? 'B'}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{t.name}</span>
                  {t.id === team.id && <span className="text-xs text-primary font-medium shrink-0">表示中</span>}
                </button>
              </li>
            ))}
          </ul>
          <Link to="/onboarding?add=1">
            <Button variant="outline" className="w-full">
              <Plus className="size-4" />
              別のチームに参加・作成する
            </Button>
          </Link>
        </CardContent>
      </Card>

      {team.myRole === 'admin' ? (
        otherMembers.length > 0 ? (
          <TransferAndLeaveDialog team={team} otherMembers={otherMembers} onLeft={handleAdminLeft} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="ghost" className="text-muted-foreground" disabled>
              <LogOut className="size-4" />
              このチームを退出する
            </Button>
            <p className="text-xs text-muted-foreground text-center px-4">
              あなたはこのチームの唯一のメンバーです。退出はできません。チーム自体が不要な場合は、プロフィール編集から「このチームを削除する」を選んでください。
            </p>
          </div>
        )
      ) : (
        <>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmLeave(true)}>
            <LogOut className="size-4" />
            このチームを退出する
          </Button>

          <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>本当に退出しますか?</AlertDialogTitle>
                <AlertDialogDescription>
                  「{team.name}」から退出します。チーム自体や他のメンバー・所属している他のチームには影響しません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
                <Button variant="destructive" disabled={leaving} onClick={handleLeaveTeam}>
                  {leaving ? '退出中...' : '退出する'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <div className="border-t pt-4">
        <Link to="/account" className="text-xs text-muted-foreground underline underline-offset-2">
          この端末のアカウントを削除する
        </Link>
      </div>
    </div>
  )
}
