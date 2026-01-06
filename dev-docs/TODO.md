# TODO

> [!IMPORTANT]
> **Priority順でソート。シンプルさ優先、過度な抽象化は避ける。**

**凡例**: 🚨 High | ⚠️ Medium | 💡 Low · ✨ Feature | 🔧 Refactor | 🐛 Bug | 🧪 Test · [S] Small | [M] Medium | [L] Large

---

## Active

- [ ] ⚠️ 🐛 [S] **非復元URLのサニタイズ漏れ** - `sanitizeSnoozedTabsV2` で `isRestorableUrl` を適用し、インポート/復元時に chrome:// 等を除外
- [ ] 💡 🔧 [S] **重複コード統合** - `getHex` が `Options.tsx` と `SnoozedList.tsx` で重複 → `utils/` に共通化

## Completed

- [x] 🚨 🐛 [S] **storageLock未適用の書き込み経路 (ユーザー操作)** - `importTabs`, `setSnoozedTabs` が `storageLock` を経由せず `popCheck`/`snooze` と競合しうる。ロック経由に統一

## Backlog

- [ ] 💡 🧪 [S] **serviceWorker結合テスト** - `onInstalled`/`onStartup` での `initStorage` ・アラーム登録・通知処理の確認
- [ ] 💡 🔧 [S] **ドキュメント更新** - ARCHITECTURE/SPEC が現行TS実装と乖離（React 18、StorageService役割、インポートフロー）
- [ ] 💡 🔧 [S] **storageLock未適用の初期化経路** - `initStorage`, `recoverFromBackup` が `storageLock` を経由しない（起動時のみのため優先度低）
