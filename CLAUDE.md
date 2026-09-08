# basketball-stats

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
