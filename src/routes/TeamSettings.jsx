import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, Pencil, Plus } from 'lucide-react'
import { supabase } from '@/supabaseClient'
import { usePlayers } from '@/hooks/usePlayers'
import { uploadTeamIcon } from '@/lib/uploadTeamIcon'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

function EditTeamDialog({ team, onTeamUpdated, children }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(team.name)
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(team.icon_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      </DialogContent>
    </Dialog>
  )
}

export function TeamSettings({ team, teams = [], onSwitchTeam, onTeamUpdated }) {
  const { players } = usePlayers(team.id)
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/onboarding?code=${team.invite_code}`

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">チーム</h1>

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

      <Card>
        <CardHeader>
          <CardTitle>所属選手</CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">まだ選手が登録されていません</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li key={p.id}>
                  <Link to={`/players/${p.id}`} className="flex items-center gap-3 rounded-lg hover:bg-muted/50 -mx-2 px-2 py-1.5">
                    <Avatar className="size-8 shrink-0 text-xs font-medium">
                      <AvatarImage src={p.photo_url} alt={p.name} />
                      <AvatarFallback className="tabular-nums">{p.number ?? '-'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.position && <p className="text-xs text-muted-foreground">{p.position}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>招待</CardTitle>
          <CardDescription>このリンクを共有すると、コーチ・マネージャーがチームに参加できます</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-sm bg-muted rounded-md px-3 py-2 break-all">{inviteUrl}</div>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'コピーしました' : 'リンクをコピー'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>マイチーム</CardTitle>
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
    </div>
  )
}
