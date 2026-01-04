# TODO

## Priority
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

## Refactoring & Maintenance

### 🟡 Important
1. [ ] 重複した`getSettings`の統合 - `snoozeLogic.js` と `timeUtils.js` に同一の関数が存在。`snoozeLogic.js`のものを正とし、`timeUtils.js`はimportに変更する。
2. [ ] `Options.jsx`の設定書き込みが背景APIをバイパス - `updateSetting`が`chrome.storage.local.set`を直接呼び出しており、`setSettings`メッセージを経由していない。
3. [ ] メッセージ契約の接続（`messages.js` の `MESSAGE_ACTIONS`/`dispatchMessage`/`sendMessage` を service worker / UI に適用）。
4. [ ] `chrome.*` APIラッパーの接続（`ChromeApi.js` を使うよう直呼びを置換）。
5. [ ] `snoozeLogic.js`のタブ復元失敗時、リトライを繰り返すのではなく、ユーザーが手動で確認できる隔離リストに移動する。

### 🟢 Nice to Have
1. [ ] Functional Core / Imperative Shell に分離（純粋ロジックと `chrome` I/O を分けてテスト容易性を上げる）。
   - Clock/Now の依存注入（`Date.now()` 直呼び排除でテスト性/再現性を向上）。
2. [ ] Popupのロジック分離と共通化。
   - `Popup` ロジックを `useSnooze` フックへ分離。
   - `timeUtils.getSettings()` を直接storage読取から排除し、呼び出し元から設定を注入する。
3. [ ] UIはV2直表示へ移行（selector層を作り、V1アダプタは import/export のみに限定）。
4. [ ] `snoozeLogic.js` の分割（スキーマ整理後に実施）。
5. [ ] データフローを`ARCHITECTURE.md`に明示セクション化。
6. [ ] エラーハンドリングの統一（ログレベル制御、通知の一元化）※`ChromeApi`導入後に実施。
7. [ ] 未使用importの整理 - `serviceWorker.js`の`getSnoozedTabs`（`getValidatedSnoozedTabs`のみ使用）、Options/Popupなど。
8. [ ] `serviceWorker.js`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。
9. [ ] `timeUtils.js`のテストカバレッジを向上させる。特に、`later-today`の日付またぎ、タイムゾーンまたぎ（DST）、不正な入力形式など、エッジケースを網羅する。
10. [ ] Reactコンポーネント（`Popup.jsx`, `Options.jsx`, `SnoozedList.jsx`）のパフォーマンス/アクセシビリティ/ベストプラクティスを、具体的観点（再レンダリングの原因、focus管理、ARIA）でレビューする。
11. [ ] ユーティリティ（`timeUtils.js`, `uuid.js`）の改善余地を観点ベースでレビューする（API表面、境界値、テスト欠落）。
12. [ ] Claude CodeのコミットをCodexで自動レビューするよう導線を整備（post-commitフック + `tools/codex-review.sh` でレビュー生成→クリップボード送信）。
13. [ ] `ACTION_ICONS`マッピングの統合 - `ShortcutEditor.jsx` と `Popup.jsx` で重複定義。`constants.js`に移動。
14. [ ] `formatDay`/`formatTime` を `timeUtils.js` に移動 - 現在 `SnoozedList.jsx` にインライン定義。
15. [ ] `StorageService`のV2対応 - 現在V1フォーマットのみ対応。UIがV2に移行する際に更新が必要。

### Done
1. [x] JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
2. [x] メッセージ契約の作成（`src/messages.js` - `MESSAGE_ACTIONS`, `validateMessageRequest`, `MESSAGE_HANDLERS`, `sendMessage`）。
3. [x] Chrome APIラッパーの作成（`src/utils/ChromeApi.js` - storage, tabs, windows, notifications, alarms, runtime の統一ラッパー）。
4. [x] V2サニタイズ時のversion保持（`getValidatedSnoozedTabs`/`recoverFromBackup` の保存前に `version` を付与）。
5. [x] schemaVersioningの配列検出（`detectSchemaVersion` は配列を無効扱いにする）。
