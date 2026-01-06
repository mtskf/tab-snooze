# TODO

> [!IMPORTANT]
> **Always keep this list sorted by Priority (High > Medium > Low).**

**Legend**:

- **Priority**: 🚨 High | ⚠️ Medium | 💡 Low
- **Type**: ✨ Feature | 🔧 Refactor | 🐛 Bug | 📦 Infra | 🧪 Test
- **Scope**: [S] Small | [M] Medium | [L] Large

---

## Refactoring & Maintenance

### ⚠️ Medium

- [ ] 🔧 [M] **ストレージ取得の一本化** - `getStorageV2` / `ensureValidStorage` / `getValidatedSnoozedTabs` を統合
- [ ] 🔧 [S] **メッセージ送信の一本化** - `messages.ts` に統一、`ChromeApi.sendMessage` を削除
- [ ] 🔧 [L] **`snoozeLogic.ts` の分割** - 責務ごとにモジュール化（~900行）

### 💡 Low

- [ ] 🐛 [S] キーボードショートカット無効化対象を拡張（`textarea`/`select`/`contenteditable`）

---

### ✅ Done

- [x] 🔧 [L] **TypeScriptへの移行** (PR #103, #107, #108, #109, #110)
- [x] 🔧 [L] **V2一本化の完了** (PR #100, #101, #102)
- [x] 🔧 [M] **ARCHITECTURE.md の強化** (PR #111)
- [x] 🐛 タブ復元失敗時ロジック改善（リトライ、再スケジュール、FailedTabsDialog）
- [x] 🔧 メッセージ契約の作成・接続（`messages.ts`）
- [x] 🔧 Chrome APIラッパー（`ChromeApi.ts`）
- [x] 🐛 V2サニタイズ時のversion保持
- [x] 🐛 schemaVersioningの配列検出
- [x] 🔧 `Options.tsx` 設定書き込みをメッセージ経由に変更
- [x] 🔧 `getSettings` 統合、`timeUtils.ts` エラーハンドリング追加
