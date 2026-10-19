import { EmptyState } from '@/components/fun/EmptyState'

// データの読み込み中に、空状態(「まだ〜がありません」)の代わりに出すボールのアニメーション。
// 読み込みが終わる前に空状態が一瞬見えてしまうのを防ぐ
export function LoadingState({ description }) {
  return <EmptyState title="読み込み中..." description={description} />
}
