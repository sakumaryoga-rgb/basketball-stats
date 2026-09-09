# basketball-stats

## コミット・プッシュのたびに行うこと

`main`にプッシュする変更(コード修正・機能追加を問わず)は、都度以下を行う。

1. `package.json`の`version`をpatchバージョンで1つ上げる(例: 23.0.2 → 23.0.3)。
   このバージョンはハンバーガーメニュー下部に表示され(`src/lib/appVersion.js`)、
   ユーザーが実際に最新の変更を受け取れているかの目印にもなる。
2. バージョンを上げたコミットに`v<バージョン>`のgitタグを付け、
   `git push origin main --tags`でタグも一緒にプッシュする。
   これにより、後から特定バージョンへの切り戻し(`git checkout v23.0.2`等)が
   いつでもできる状態を保つ。

## PWA更新機能を変更するとき

`vite.config.js` / `registerType` / Workbox設定 / `vite-plugin-pwa`のバージョン更新 /
Service Worker関連コード(`src/main.jsx`, `src/lib/swUpdate.js`) / 更新モーダル・バナーの
ロジック(`src/components/UpdatePrompt.jsx`) / `public/version.json` の
`minSupportedVersion` のいずれかを変更する場合は、必ず
[`docs/pwa-update-regression-checklist.md`](docs/pwa-update-regression-checklist.md) の
5項目を`vite build`+`vite preview`の本番相当環境で再検証すること。

見た目(バナー/モーダルの表示)だけでなく、`reg.waiting` / `reg.active` /
`navigator.serviceWorker.controller` / `controllerchange` も必ず確認する。過去に
`registerType`とWorkboxの`clientsClaim`設定の不備で、この機能が本番で一度も正常動作していな
かった実績があるため。
