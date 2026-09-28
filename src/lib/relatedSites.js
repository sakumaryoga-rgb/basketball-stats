// ハンバーガーメニュー内「関連サイト」に表示する外部リンクの一覧。
// URLはUIコンポーネント側にベタ書きせず、ここに集約している(将来
// 差し替える場合もこのファイルのurlを書き換えるだけでよい)。
// 各URLは運営者から共有された共有リンクから、SNS共有用のトラッキング
// クエリパラメータ(?sub_rt=, ?igshid=, ?s=&t= 等)を取り除いた正規URL。
export const RELATED_SITES = [
  {
    key: "note-guide",
    label: "note「使い方完全ガイド」",
    url: "https://note.com/whatisthematrix/n/na27258f50f58",
  },
  {
    key: "threads",
    label: "Threads公式アカウント",
    url: "https://www.threads.com/@basketballstats.app",
  },
  {
    key: "x",
    label: "X公式アカウント",
    url: "https://x.com/bballstasapp",
  },
]
