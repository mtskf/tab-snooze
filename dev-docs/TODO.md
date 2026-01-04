# TODO

## Priority
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

## Refactoring & Maintenance

### 🟡 Important
1. [ ] `timeUtils.js`の設定取得をbackground依存から切り離し、取得失敗時は`DEFAULT_SETTINGS`へ安全にフォールバックする（`Popup`の`getTime`失敗も防ぐ）。
2. [ ] `snoozeLogic.js`のタブ復元失敗時、リトライを繰り返すのではなく、ユーザーが手動で確認できる隔離リストに移動する。

### 🟢 Nice to Have
1. [ ] `StorageService`のV2対応 - 現在V1フォーマットのみ対応。UIがV2に移行する際に更新が必要。
2. [ ] UIはV2直表示へ移行（selector層を作り、V1アダプタは import/export のみに限定）。
3. [ ] `Options.jsx`のImport/Exportロジックをバックグラウンドへ移動 - 現在UIメインスレッドで処理しており、`setSnoozedTabs`メッセージで巨大なデータを送っている。`StorageService`をバックグラウンド側（`serviceWorker` or `snoozeLogic`）に移動すべき。
4. [ ] インポート時に重複タブをデデュープする方針を決めて実装する（キー設計: `url`+`popTime`など）。
5. [ ] Popupのロジック分離と共通化。
   - `Popup` ロジックを `useSnooze` フックへ分離。
6. [ ] `snoozeLogic.js` の分割（スキーマ整理後に実施）。
7. [ ] Functional Core / Imperative Shell に分離（純粋ロジックと `chrome` I/O を分けてテスト容易性を上げる）。
   - Clock/Now の依存注入（`Date.now()` 直呼び排除でテスト性/再現性を向上）。
8. [ ] エラーハンドリングの統一（ログレベル制御、通知の一元化）※`ChromeApi`導入後に実施。
9. [ ] データフローを`ARCHITECTURE.md`に明示セクション化。
10. [ ] `serviceWorker.js`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。
11. [ ] 非同期処理中にコンポーネントがアンマウントされた場合の`setState`ガードを追加する（`Options`/`Popup`）。
12. [ ] キーボードショートカットの無効化対象を`input`以外（`textarea`/`select`/`contenteditable`）にも拡張する。
13. [ ] 未使用importの整理 - `serviceWorker.js`の`getSnoozedTabs`（`getValidatedSnoozedTabs`のみ使用）、Options/Popupなど。
14. [ ] `ACTION_ICONS`マッピングの統合 - `ShortcutEditor.jsx` と `Popup.jsx` で重複定義。`constants.js`に移動。
15. [ ] `formatDay`/`formatTime` を `timeUtils.js` に移動 - 現在 `SnoozedList.jsx` にインライン定義。
16. [ ] `timeUtils.js`のテストカバレッジを向上させる。特に、`later-today`の日付またぎ、タイムゾーンまたぎ（DST）、不正な入力形式など、エッジケースを網羅する。
17. [ ] Reactコンポーネント（`Popup.jsx`, `Options.jsx`, `SnoozedList.jsx`）のパフォーマンス/アクセシビリティ/ベストプラクティスを、具体的観点（再レンダリングの原因、focus管理、ARIA）でレビューする。
18. [ ] ユーティリティ（`timeUtils.js`, `uuid.js`）の改善余地を観点ベースでレビューする（API表面, 境界値, テスト欠落）。
19. [ ] JSDoc型定義の整理 - `snoozeLogic.js` や `messages.js` に残っている冗長な `@typedef` を削除し、`types.js` からのインポートに統一する。
20. [ ] Claude CodeのコミットをCodexで自動レビューするよう導線を整備（post-commitフック + `tools/codex-review.sh` でレビュー生成→クリップボード送信）。

### Done
1. [x] JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
2. [x] メッセージ契約の作成（`src/messages.js` - `MESSAGE_ACTIONS`, `validateMessageRequest`, `MESSAGE_HANDLERS`, `sendMessage`）。
3. [x] Chrome APIラッパーの作成（`src/utils/ChromeApi.js` - storage, tabs, windows, notifications, alarms, runtime の統一ラッパー）。
4. [x] V2サニタイズ時のversion保持（`getValidatedSnoozedTabs`/`recoverFromBackup` の保存前に `version` を付与）。
5. [x] schemaVersioningの配列検出（`detectSchemaVersion` は配列を無効扱いにする）。
6. [x] `Options.jsx`の設定書き込みが背景APIをバイパス - `updateSetting`を`chrome.storage.local.set`から`chrome.runtime.sendMessage({ action: 'setSettings' })`に変更（TDDで実装）。
7. [x] メッセージ契約の接続（`messages.js` の `MESSAGE_ACTIONS`/`dispatchMessage`/`sendMessage` を service worker / UI に適用）。
8. [x] 重複した`getSettings`の統合 - `snoozeLogic.js` と `timeUtils.js` に同一の関数が存在。`snoozeLogic.js`のものを正とし、`timeUtils.js`はimportに変更する。
