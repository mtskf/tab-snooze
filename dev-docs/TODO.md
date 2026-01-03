# TODO

## Code review
- [ ] b00cd1e73fc464b39500cbfff399ea34973d52a6
- [ ] b5b447c3632f7d0a56e26830eaba1235c29b68eb
- [ ] b96ab912eb87e83da330744ebd018c0dcf9726d9
- [ ] b96ab912eb87e83da330744ebd018c0dcf9726d9
- [ ] fa2a3f78a1f873e08a71871f5ecd59cd381fc67c
- [ ] 5f16cf5748725beaa57ffe9250348285cb79abc0
- [ ] d2ae50325f9432e58f317a0c6be1271b6b5aded4
- [ ] fe7495b165fc633f3ecda21d3054c83e2f69e8a2

## Known Issues

- [x] High: `restoreTabs` のクリーンアップが `storageLock` にチェーンされていないと復元中の書き込みと競合し上書きレースが起き得る。snoozeLogic.js (lines 626-663)
- [x] Medium: グループ復元が部分失敗検知を行わず、`chrome.windows.create({ url: [...] })` が一部URLを開けない場合でも成功扱いで削除され得る。snoozeLogic.js (lines 586-598)
- [x] Medium: `snoozeLogic.js` が `validation.js` を直接importしているため、背景SWが分割バンドルになっていると読み込み失敗のリスク。`vite.config.js` で background を単一バンドルに固定できているか要確認。snoozeLogic.js / vite.config.js
    - Note: Configured `"type": "module"` in `manifest.json` to support split bundles (validation.js).
- [x] High: 手動のグループ復元 (restoreWindowGroup) が部分失敗検知を行わず、chrome.windows.create が一部URLを開けない場合でも必ず削除します。過去に保存済みの制限URLが混在しているとデータ消失の可能性。snoozeLogic.js (lines 742-753)
- [x] Medium: インポート失敗時のエラーメッセージが古い判定のままで、JSONは正しいが構造不正のケースで「Invalid JSON file.」と表示されます。Options.jsx (lines 234-238)

## Simplification Opportunities

- [ ] Medium: `Options.jsx` の Import/Export ロジック分離。ファイル読み込み、JSONパース、バリデーションロジックがコンポーネント内にあり、肥大化しています。これらを `StorageService.js` 等に移動し、UIは「呼び出すだけ」にシンプル化すべきです。
- [x] High: ストレージ構造の刷新。`timestamp -> [tabs] + tabCount` 形式をやめ、`tabsById` と `popTimeIndex` の2構造に変更する。復元/削除がIDベースになり、整合性維持と再計算ロジックが大幅に簡素化される。
- [x] High: スキーマ移行の一本化。`migrateStorage()` を作り、起動時に一度だけ旧スキーマから新スキーマへ変換する（ストレージ刷新と同時に実施）。以降は最新スキーマ前提でロジックを簡素化できる。
- [x] High: 書き込み経路の一本化。`setSnoozedTabs` を直接呼ぶ箇所を排除し、キュー/単一関数に集約して全更新を直列化する。レース条件と不整合の温床を減らせる。
- [x] High: 重複コードの削除 (`snoozeLogic.js`). バリデーションロジック (`validateTabEntry`, `validateSnoozedTabs`, `sanitizeSnoozedTabs`) が `src/utils/validation.js` と完全に重複しています。インライン定義を削除し、ユーティリティからのimportに置き換えることで、約100行のコードを削減できます。`DEFAULT_SETTINGS` も同様に重複しています。
- [x] Medium: 復元処理の統合。`restoreTabs` と `restoreWindowGroup` を統合し、復元対象リストを渡すだけにする。例外処理・検証・削除ロジックの重複を排除できる。
- [x] Low: 未使用関数の削除。`ensureSnoozedTabs` と `addToStorage` は参照されていないため削除して整理できます。snoozeLogic.js (lines 331-373)


## Refactoring Opportunities
- [ ] Medium: 定数の集約管理。`RESTRICTED_PROTOCOLS` や `STORAGE_LIMIT` などが散在しています。`src/utils/constants.js` に移動し、再利用性とメンテナンス性を向上させるべきです。
- [ ] Medium: Popupロジックの分離。`Popup.jsx` 内にあるスヌーズ実行やデータ取得ロジックをカスタムフック (`useSnooze.js` 等) に切り出し、ViewとLogicを分離することでテスト容易性を向上させます。
- [ ] Low: エラーハンドリングの統一。`console.warn` / `error` の使い分けや、ユーザーへの通知（`chrome.notifications`）の仕組みを一箇所にまとめ、ログ出力レベルを制御できるようにします。
- [ ] Low: `restoreTabs` のフラット化。ネストが深く（ループ内ループ内非同期処理）、可読性が低いです。上記「復元処理の統合」で不要になる可能性が高いです。
- [ ] Low: `snoozeLogic.js` の分割は優先度を下げる。ストレージ刷新と書き込み経路の一本化が先に必要で、今やると二度手間になりやすい。
