import { ExternalLink } from "lucide-react"
import { XGlyphIcon, ThreadsGlyphIcon, NoteGlyphIcon } from "@/components/icons/BrandGlyphs"
import { RELATED_SITES } from "@/lib/relatedSites"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// キー→アイコンの対応。アイコンは表示上の関心事のためデータ(relatedSites.js)
// ではなくここで管理する(URLだけを差し替えられる状態を保つため)。各社の
// 公式ロゴをそのまま複製せず、簡略化(デフォルメ)した独自マークを使っている
// (BrandGlyphs.jsx参照)。
const ICON_BY_KEY = {
  "note-guide": NoteGlyphIcon,
  threads: ThreadsGlyphIcon,
  x: XGlyphIcon,
}

// ハンバーガーメニューのトグル展開・将来の専用ページの両方から使い回せる、
// 「関連サイト」一覧の表示だけを担当する部品。リンク先の確定/未確定判定も
// ここに閉じ込めており、呼び出し側はレイアウト(間隔・インデント等)だけを
// classNameで調整すればよい。
export function RelatedSitesList({ className }) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {RELATED_SITES.map((site) => {
        const Icon = ICON_BY_KEY[site.key] ?? ExternalLink
        const hasUrl = Boolean(site.url)
        return (
          <li key={site.key}>
            {hasUrl ? (
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg py-2.5 pr-3 pl-4 text-sm hover:bg-muted"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{site.label}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ) : (
              <div className="flex items-center gap-3 rounded-lg py-2.5 pr-3 pl-4 text-sm text-muted-foreground">
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{site.label}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  準備中
                </Badge>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
