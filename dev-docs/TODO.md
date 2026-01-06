# TODO

**Legend**:
- **Priority**: 🚨 High | ⚠️ Medium | 💡 Low
- **Type**: ✨ Feature | 🔧 Refactor | 🐛 Bug | ⚡ Performance | 📦 Infra
- **Scope**: [S] Small | [M] Medium | [L] Large

---

## Refactoring & Maintenance

### 💡 Low

- [ ] 🔧 [M] `SnoozedList.tsx` の表示ロジック（グルーピング）をフック/ユーティリティに分離し、ユニットテストを強化する。
   - 現在UI内にインライン記述されている複雑な日付/ウィンドウグループ化ロジックをテスト可能な形にする。

- [ ] 🔧 [S] `Popup.tsx` と `timeUtils.ts` で重複する「早朝/週末/終了時間判定」ロジックを共通化する。

- [ ] 🔧 [M] ストレージ取得の一本化（`getStorageV2` / `ensureValidStorage` / `getValidatedSnoozedTabs` を統合）。


- [ ] 🔧 [S] メッセージ送信の一本化（`messages.ts`に統一し、`ChromeApi`側の`sendMessage`を削除）。

- [ ] ✨ [M] インポート時に重複タブをデデュープする方針を決めて実装する（キー設計: `url`+`popTime`など）。

- [ ] 🔧 [M] Popupのロジック分離と共通化。
   - `Popup` ロジックを `useSnooze` フックへ分離。

- [ ] 🔧 [L] `snoozeLogic.ts` の分割（スキーマ整理後に実施）。

- [ ] 🔧 [L] Functional Core / Imperative Shell に分離（純粋ロジックと `chrome` I/O を分けてテスト容易性を上げる）。
   - Clock/Now の依存注入（`Date.now()` 直呼び排除でテスト性/再現性を向上）。

- [ ] 🔧 [M] エラーハンドリングの統一（ログレベル制御、通知の一元化）※`ChromeApi`導入後に実施。

- [ ] 🔧 [S] データフローを`ARCHITECTURE.md`に明示セクション化。

- [ ] 🔧 [S] `serviceWorker.ts`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。

- [ ] 🐛 [S] 非同期処理中にコンポーネントがアンマウントされた場合の`setState`ガードを追加する（`Options`/`Popup`）。

- [ ] 🐛 [S] キーボードショートカットの無効化対象を`input`以外（`textarea`/`select`/`contenteditable`）にも拡張する。

- [ ] 🔧 [S] `serviceWorker.ts`の再整理 - `setTimeout`のマジックナンバー排除、`checkPendingRecoveryNotification`のロジック分離。

- [ ] 🧪 [M] 統合テスト(E2E)の導入調査 - モックに頼らない実際のブラウザ挙動(Playwright等)での復元テスト。

- [ ] 🔧 [S] 未使用importの整理 - `serviceWorker.ts`の`getSnoozedTabs`（`getValidatedSnoozedTabs`のみ使用）、Options/Popupなど。

- [ ] 🧪 [S] OptionsのFailedTabsDialog統合テストで`window.location`再定義を避け、`history.pushState`を使ったより堅牢なURL制御に置き換える（低優先）。

---

#### 💡 低リスク簡素化（Phase 1）

- [ ] 🔧 [S] `uuid.ts`の削除 - `crypto.randomUUID()`へ置換（Chrome 92+/Firefox 95+対応済み）。

- [ ] 🔧 [S] `ACTION_ICONS`マッピングの統合 - `ShortcutEditor.tsx` と `Popup.tsx` で重複定義。`constants.ts`に移動。

- [ ] 🔧 [S] `formatDay`/`formatTime` を `timeUtils.ts` に移動 - 現在 `SnoozedList.tsx` にインライン定義。

- [ ] 🔧 [M] `timeUtils.ts`のテストカバレッジを向上させる。特に、`later-today`の日付またぎ、タイムゾーンまたぎ（DST）、不正な入力形式など、エッジケースを網羅する。

- [ ] 🔧 [M] Reactコンポーネント（`Popup.tsx`, `Options.tsx`, `SnoozedList.tsx`）のパフォーマンス/アクセシビリティ/ベストプラクティスを、具体的観点（再レンダリングの原因、focus管理、ARIA）でレビューする。

- [ ] 🔧 [S] ユーティリティ（`timeUtils.ts`, `uuid.ts`）の改善余地を観点ベースでレビューする（API表面, 境界値, テスト欠落）。

- [ ] 🔧 [S] JSDoc型定義の整理 - `snoozeLogic.ts` や `messages.ts` に残っている冗長な `@typedef` を削除し、`types.ts` からのインポートに統一する。

- [ ] 📦 [M] Claude CodeのコミットをCodexで自動レビューするよう導線を整備（post-commitフック + `tools/codex-review.sh` でレビュー生成→クリップボード送信）。

---

### ✅ Done

- [x] 🔧 [L] **TypeScriptへの移行** (PR #103, #107, #108, #109, #110)
  - Phase 1: インフラ整備 (tsconfig, vite.config.ts, @types/chrome)
  - Phase 2-5: 型定義・ユーティリティ・メッセージング・バックグラウンド層
  - Phase 6: Reactコンポーネント層
  - Phase 7: テストセットアップ
  - Phase 8: クリーンアップ (`allowJs: false`)

- [x] 🔧 [L] **V2一本化の完了** (PR #100, #101, #102)
  1. StorageService V2対応 + Selector層追加
  2. UI V2直表示へ移行
  3. Import/Exportロジックをバックグラウンドへ移動
  4. V1アダプタ/バリデーション/レガシーコード撤去 (~430行削除)

- [x] 🐛 `snoozeLogic.ts`のタブ復元失敗時のロジック改善
  1. `restoreTabs`内でリトライを行う（200ms間隔で最大3回）。
  2. 最終的に失敗したタブは5分後に再スケジュールし、通知を表示。
  3. 通知クリックでOptionsを開き、失敗タブ一覧をDialog（shadcn/ui）で表示。

- [x] 🔧 JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。

- [x] 🔧 メッセージ契約の作成（`src/messages.ts` - `MESSAGE_ACTIONS`, `validateMessageRequest`, `MESSAGE_HANDLERS`, `sendMessage`）。

- [x] 🔧 Chrome APIラッパーの作成（`src/utils/ChromeApi.ts` - storage, tabs, windows, notifications, alarms, runtime の統一ラッパー）。

- [x] 🐛 V2サニタイズ時のversion保持（`getValidatedSnoozedTabs`/`recoverFromBackup` の保存前に `version` を付与）。

- [x] 🐛 schemaVersioningの配列検出（`detectSchemaVersion` は配列を無効扱いにする）。

- [x] 🔧 `Options.tsx`の設定書き込みが背景APIをバイパス - `updateSetting`を`chrome.storage.local.set`から`chrome.runtime.sendMessage({ action: 'setSettings' })`に変更（TDDで実装）。

- [x] 🔧 メッセージ契約の接続（`messages.ts` の `MESSAGE_ACTIONS`/`dispatchMessage`/`sendMessage` を service worker / UI に適用）。

- [x] 🔧 重複した`getSettings`の統合 - `snoozeLogic.ts` と `timeUtils.ts` に同一の関数が存在。`snoozeLogic.ts`のものを正とし、`timeUtils.ts`はimportに変更する。

- [x] 🔧 `timeUtils.ts`の`getTime()`にエラーハンドリングを追加し、取得失敗時は`DEFAULT_SETTINGS`へ安全にフォールバックする。

- [x] 🔧 `timeUtils.ts`の`getSettings`依存を`snoozeLogic.ts`から切り離す（`ChromeApi`を直接使用）。
