// 「関連サイト」一覧用の、各サービスをイメージした簡略化(デフォルメ)アイコン。
// 各社の公式ロゴファイル・正確なパスデータをそのまま複製するのではなく、
// lucide-reactの線画アイコン(viewBox 24x24, stroke=currentColor)と馴染む
// トーン・線幅で独自に描き起こしたシンプルなマークにしている。
// 既存のlucide-reactのAPI(size-*クラスで大きさ調整、currentColorで着色)と
// 同じ感覚で使える、drop-inのアイコンコンポーネント群。

export function XGlyphIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  )
}

export function ThreadsGlyphIcon(props) {
  // Threadsの投稿はすべて「@ハンドル名」で表示されるため、公式ロゴの曲線を
  // なぞる代わりに@マークで簡略化している(noteの"n"と同じ文字ベースの方式)。
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <text x="12" y="18.5" textAnchor="middle" fontSize="22" fontWeight="700">
        @
      </text>
    </svg>
  )
}

export function NoteGlyphIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <text x="12" y="18" textAnchor="middle" fontSize="21" fontWeight="700" fontFamily="Georgia, serif">
        n
      </text>
    </svg>
  )
}
