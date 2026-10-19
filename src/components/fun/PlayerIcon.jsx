import { Jersey } from '@/components/fun/Jersey'
import { cn } from '@/lib/utils'

// 選手の丸型アイコン。プロフィール画像(photo_url)があれば丸く表示し、右下に背番号を小さく添える。
// 画像が無い選手は従来どおり背番号入りのユニフォーム(Jersey)を表示する。
// className でサイズ(size-8など)を指定する
export function PlayerIcon({ player, color, className }) {
  if (!player?.photo_url) return <Jersey number={player?.number} color={color} className={className} />
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <img
        src={player.photo_url}
        alt=""
        loading="lazy"
        draggable={false}
        className="size-full rounded-full object-cover ring-2 ring-white/80"
      />
      {player.number != null && (
        <span
          className="absolute -bottom-0.5 -right-1 min-w-[1.1rem] rounded-full px-1 text-center font-heading text-[9px] leading-[1.1rem] text-white ring-2 ring-white/90"
          style={{ background: color }}
        >
          {player.number}
        </span>
      )}
    </span>
  )
}
