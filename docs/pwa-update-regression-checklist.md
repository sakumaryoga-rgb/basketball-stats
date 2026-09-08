# PWA更新機能 回帰テスト基準

2026-09-08の実機検証で、PWA更新通知機能(`registerType`/`workbox.clientsClaim`の設定不備)が
本番で一度も正常動作していなかったことが判明した。同種の不具合を将来の変更で再発させないため、
このチェックリストを固定の回帰テスト基準とする。

## 対象となる変更

以下のいずれかを変更した場合、リリース前に必ず下記5項目を再検証すること。

- `vite.config.js`
- `registerType`(vite-plugin-pwaのオプション)
- Workbox設定(`workbox.*`、特に`clientsClaim`/`skipWaiting`)
- `vite-plugin-pwa`のバージョンアップ
- Service Worker関連コード(`src/main.jsx`のregisterSW呼び出し、`src/lib/swUpdate.js`)
- 更新モーダル/更新バナーのロジック(`src/components/UpdatePrompt.jsx`)
- `public/version.json` / `src/lib/appVersion.js`の`minSupportedVersion`判定

## 検証環境

**必ず本番相当ビルドで検証する。**`vite dev`は実際のService Workerを登録しないため、
このチェックの代わりにはならない。

```bash
npm run build
npx vite preview --port 4173 --strictPort
```

見た目(バナー/モーダルの表示)だけでなく、必ずブラウザのコンソールから以下も直接確認すること。
見た目だけの確認では、今回発生したような「表示されないが内部的には動いているつもり」の不具合を
見逃す。

```js
const reg = await navigator.serviceWorker.getRegistration();
reg.waiting;        // 新SWが待機中か
reg.active;         // 現在アクティブなSW
navigator.serviceWorker.controller; // 現在このページを制御しているSW(nullなら無制御)
```

`controllerchange`イベントが発火するかどうかは、`navigator.serviceWorker.oncontrollerchange`に
一時的にリスナーを張って確認する。

新バージョンの検知は1時間待たず、`registration.update()`を手動実行してよい(更新チェック間隔
自体は変更しない)。新旧バンドルを区別させたい場合は、ソースに動作へ影響しない差分(例:
`console.info`の文言変更)を加えてから再ビルドすると、新しいプリキャッシュのハッシュが生成される。

## 回帰テスト項目(5項目)

### 1. 通常画面でのブロッキング表示
新バージョンを検知した状態で、記録中でない画面(例: `/practice`, `/players`)にいる場合、
全画面ブロッキングの更新モーダルが表示される。

- 確認: `document.body.innerText`に「最新のアップデートがあります」が含まれる
- 確認: モーダルは閉じる手段がなく、「更新する」を押すまで背後の操作ができない

### 2. 記録中は非ブロッキング
`/games/:id`または`/shooting/:id`にいる状態で新バージョンを検知した場合、強制モーダルではなく
画面下の非ブロッキング通知(バナー)が表示され、入力操作(スタッツ記録・シュート記録など)が
妨げられない。

- 確認: `document.body.innerText`に「記録終了後に更新されます」が含まれる
- 確認: 画面上のボタン・タップ操作がバナー表示中も引き続き機能する

### 3. 離脱時の自動昇格
上記2の状態から記録画面を離れた(一覧に戻る/他の画面へ遷移した)瞬間、保留中の更新が
自動的にブロッキング更新モーダルへ切り替わる。追加の操作や再読み込みは不要であること。

- 確認: 遷移直後に`document.body.innerText`が「記録終了後に更新されます」→
  「最新のアップデートがあります」に変わる

### 4. 「更新する」で実際にリロードされる
ブロッキングモーダルの「更新する」を押した際、Service Workerのskip-waiting→activate→
controllerの引き継ぎが実際に発生し、ページが新しいJSバンドルへリロードされる。

- 確認: クリック前後で`reg.waiting`が`true`→`false`になる
- 確認: `navigator.serviceWorker.controller`が`null`にならず、新しいSWのインスタンスに
  引き継がれる(`controllerchange`が発火する)
- 確認: リロード後、`document.querySelectorAll('script[src*="index-"]')`が指すJSファイル名の
  ハッシュが更新前と変わっている

### 5. minSupportedVersionによる強制ブロック
`public/version.json`の`minSupportedVersion`を現在のアプリバージョン(`package.json`の
`version`)より高い値にした場合、`/games/:id`または`/shooting/:id`の記録中であっても
強制的にブロッキング表示(「重要な更新が必要です」)になる。

- 確認: 記録中ルートにいても、通常の非ブロッキングバナーではなく強制ブロッキングモーダルが
  表示される
- 検証後は必ず`minSupportedVersion`を元の値に戻す(本番の`public/version.json`を誤って
  高い値のままコミット/デプロイしないこと)

## 背景: 今回発生した不具合

検証を始めるまで、上記5項目はすべて「実装したつもり」で未検証のまま本番に出ていた。

- **`registerType: 'autoUpdate'`** — vite-plugin-pwaの`virtual:pwa-register`クライアント側の
  実装上、`onNeedRefresh`コールバックを購読する分岐に到達せず、新バージョンを検知しても
  バナーもモーダルも一切表示されなかった。`registerType: 'prompt'`に修正。
- **`workbox.clientsClaim`未設定** — 「更新する」を押してskipWaitingメッセージを送っても、
  既に開いているタブは新しいSWに`clients.claim()`されず、`controllerchange`が発火しないため
  リロードが実行されなかった。`workbox: { clientsClaim: true }`を追加。

いずれも画面を一目見ただけでは気づけず、`reg.waiting`/`reg.active`/`controller`の実際の状態を
確認して初めて発覚した。これが「見た目だけでなく内部状態も確認する」を必須項目にしている理由。

## 自動化の検討

現時点でこのプロジェクトにはテストランナー(Vitest/Playwright等)もCIワークフローも存在しない。
5項目の自動化自体はPlaywrightで技術的に十分可能(Chromiumの`serviceWorker`イベント・
`page.evaluate`でService Worker APIを直接操作できるため、今回手動で行った確認をほぼそのまま
スクリプト化できる)だが、以下を要するため、導入するかは別途判断が必要:

- `@playwright/test`等の新規devDependency追加とブラウザバイナリのダウンロード
- `.github/workflows`等のCI基盤の新規構築(現状皆無)
- `vite build`→`vite preview`をCI上で起動し、Service Workerの2世代分のビルド成果物を
  用意する専用のテストシナリオ設計

導入する場合の最小構成イメージ:

1. `npm run build`でビルドA相当を生成し、`vite preview`をCI上でバックグラウンド起動
2. Playwrightでページを開きSW登録を待機
3. ソースに無害な差分を加えて再ビルド(ビルドB)し、同じ`preview`サーバーに反映
4. `page.evaluate`で`registration.update()`を呼び、上記5項目の状態をアサート
5. `minSupportedVersion`を書き換えたビルドCで項目5を追加検証

このドキュメントの5項目とアサーション内容が一致するように保守すること。自動化に着手する際は、
このチェックリストを仕様書として扱う。
