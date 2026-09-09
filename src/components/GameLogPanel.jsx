import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { STAT_CATEGORIES, STAT_KEY_LABEL, formatQuarter } from '@/lib/stats'
import { Button } from '@/components/ui/button'
import {
  Dialog,
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

// statKeyから、編集ダイアログの初期状態(どのカテゴリ・どの結果を選んでいたか)を逆引きする
function findSelection(statKey) {
  for (const category of STAT_CATEGORIES) {
    if (category.kind === 'shot' || category.kind === 'ft') {
      if (category.make === statKey) return { categoryKey: category.key, outcome: 'make' }
      if (category.miss === statKey) return { categoryKey: category.key, outcome: 'miss' }
    } else if (category.kind === 'pair') {
      if (category.left.key === statKey || category.right.key === statKey) {
        return { categoryKey: category.key, pairKey: statKey }
      }
    } else if (category.kind === 'single') {
      if (category.stat === statKey) return { categoryKey: category.key }
    }
  }
  return { categoryKey: STAT_CATEGORIES[0].key }
}

function EditEventDialog({ event, players, onSave, onOpenChange }) {
  const initial = findSelection(event.stat_key)
  const [playerId, setPlayerId] = useState(event.player_id)
  const [categoryKey, setCategoryKey] = useState(initial.categoryKey)
  const [outcome, setOutcome] = useState(initial.outcome ?? null)
  const [pairKey, setPairKey] = useState(initial.pairKey ?? null)
  const [saving, setSaving] = useState(false)

  const category = STAT_CATEGORIES.find((c) => c.key === categoryKey)

  function handleCategorySelect(key) {
    setCategoryKey(key)
    setOutcome(null)
    setPairKey(null)
  }

  function resolveStatKey() {
    if (category.kind === 'shot' || category.kind === 'ft') {
      return outcome === 'make' ? category.make : outcome === 'miss' ? category.miss : null
    }
    if (category.kind === 'pair') return pairKey
    return category.stat
  }

  const statKey = resolveStatKey()
  const canSave = !!playerId && !!statKey

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const ok = await onSave({ playerId, statKey })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>プレイを修正</DialogTitle>
          <DialogDescription>選手とスタッツの内容を変更できます</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">選手</p>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlayerId(p.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm',
                    playerId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                  )}
                >
                  {p.number != null ? `#${p.number} ` : ''}
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">スタッツ</p>
            <div className="grid grid-cols-3 gap-2">
              {STAT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCategorySelect(c.key)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-1 py-1.5 text-center text-xs',
                    categoryKey === c.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {(category.kind === 'shot' || category.kind === 'ft') && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={outcome === 'miss' ? 'default' : 'outline'}
                onClick={() => setOutcome('miss')}
              >
                失敗
              </Button>
              <Button
                type="button"
                variant={outcome === 'make' ? 'default' : 'outline'}
                onClick={() => setOutcome('make')}
              >
                成功
              </Button>
            </div>
          )}

          {category.kind === 'pair' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={pairKey === category.left.key ? 'default' : 'outline'}
                onClick={() => setPairKey(category.left.key)}
              >
                {category.left.label}
              </Button>
              <Button
                type="button"
                variant={pairKey === category.right.key ? 'default' : 'outline'}
                onClick={() => setPairKey(category.right.key)}
              >
                {category.right.label}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>キャンセル</DialogClose>
          <Button type="button" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? '保存中...' : '保存する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 試合の記録を時系列で一覧表示し、プレイ単位で修正・削除できるようにするパネル。
// SHOT CHARTタブの右側に配置する想定(GameDetail.jsx参照)
export function GameLogPanel({ events, gamePlayers, periodSystem, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const playerById = new Map(gamePlayers.map((p) => [p.id, p]))
  const editingEvent = events.find((e) => e.id === editingId) ?? null

  async function handleConfirmDelete() {
    if (!deletingId) return
    setDeleting(true)
    await onDelete(deletingId)
    setDeleting(false)
    setDeletingId(null)
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">まだプレイの記録がありません</p>
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '60vh' }}>
      {[...events].reverse().map((event) => {
        const player = playerById.get(event.player_id)
        return (
          <div key={event.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs">
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
              {formatQuarter(event.quarter, periodSystem)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">
                {player ? (player.number != null ? `#${player.number} ` : '') + player.name : '?'}
              </p>
              <p className="truncate text-muted-foreground">{STAT_KEY_LABEL[event.stat_key] ?? event.stat_key}</p>
            </div>
            <button
              type="button"
              aria-label="修正"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setEditingId(event.id)}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="削除"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"
              onClick={() => setDeletingId(event.id)}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )
      })}

      {editingEvent && (
        <EditEventDialog
          event={editingEvent}
          players={gamePlayers}
          onSave={(patch) => onEdit(editingEvent.id, { ...patch, quarter: editingEvent.quarter })}
          onOpenChange={(open) => !open && setEditingId(null)}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>このプレイを削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>元に戻せません。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>キャンセル</AlertDialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleConfirmDelete}>
              削除する
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
