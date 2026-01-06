# TODO

> [!IMPORTANT]
> **Always keep this list sorted by Priority (High > Medium > Low).**

**Legend**:

- **Priority**: 🚨 High | ⚠️ Medium | 💡 Low
- **Type**: ✨ Feature | 🔧 Refactor | 🐛 Bug | ⚡ Performance | 📦 Infra | 🧪 Test
- **Scope**: [S] Small | [M] Medium | [L] Large

---

## 🤖 AI Agent Infrastructure

> AI自律開発の基盤。これらがないとエージェントは自己検証できない。

### 🚨 High

- [ ] 📦 [M] **Validation Scripts の整備**
  - `npm run type-check` (tsc --noEmit)
  - `npm run lint` (ESLint + Prettier)
  - `npm run verify` (type-check → lint → test → build を順次実行)
  - `tools/verify.sh` でローカル一括検証

- [ ] 📦 [M] **CI/CD の導入**
  - `.github/workflows/verify.yml`: PR時に `npm run verify` 実行
  - カバレッジレポート、マージブロック設定

### ⚠️ Medium

- [ ] 📦 [S] **CONTRIBUTING.md の作成**
  - 開発セットアップ手順、コマンド集
  - PR要件、TDDルール、型安全ガイドライン
  - dev-docs/ へのリンク

- [ ] 📦 [S] **ESLint + Prettier 設定の追加**
  - TypeScript/React対応ルール
  - `husky` + `lint-staged` で pre-commit フック

- [ ] 🧪 [S] **テストカバレッジ閾値の設定**
  - `vitest.config.ts`: lines 80%, branches 70%
  - CI で低下時にマージブロック

### 💡 Low

- [ ] 📦 [M] `tools/release.sh` の作成 - zip生成、manifest調整、バージョンバンプ自動化

- [ ] 🧪 [M] E2E テストの導入調査 - Playwright等でモックなしのブラウザテスト

---

## Refactoring & Maintenance

### ⚠️ Medium

#### 📐 アーキテクチャ・ドキュメント

- [ ] 🔧 [M] **ARCHITECTURE.md の強化**
  - エグゼクティブサマリー（1ページ概要）追加
  - データフロー図の明示セクション化
  - V2データモデル、メッセージ契約、snooze/restoreフロー

- [ ] 🔧 [S] URL検証の境界ルール（`validateTabEntry` vs `isRestorableUrl`）を設計メモに追記

#### 🧹 コード統合・簡素化

- [ ] 🔧 [M] **ストレージ取得の一本化**
  - `getStorageV2` / `ensureValidStorage` / `getValidatedSnoozedTabs` を統合

- [ ] 🔧 [S] メッセージ送信の一本化 - `messages.ts` に統一、`ChromeApi.sendMessage` を削除

- [ ] 🔧 [S] `uuid.ts` の削除 - `crypto.randomUUID()` へ置換（Chrome 92+対応済み）

- [ ] 🔧 [S] `ACTION_ICONS` マッピングの統合 - `ShortcutEditor.tsx`/`Popup.tsx` から `constants.ts` へ移動

- [ ] 🔧 [S] `formatDay`/`formatTime` を `timeUtils.ts` へ移動（現在 `SnoozedList.tsx` にインライン定義）

- [ ] 🔧 [S] JSDoc `@typedef` の整理 - `snoozeLogic.ts`/`messages.ts` の冗長な定義を削除、`types.ts` に統一

#### 🏗️ ロジック分離

- [ ] 🔧 [M] **`Options.tsx` のロジック分離**
  - `useSnoozeActions`, `useOptionsState` などカスタムフックへ分離

- [ ] 🔧 [M] **`SnoozedList.tsx` のグルーピングロジック分離**
  - 日付/ウィンドウグループ化をフック/ユーティリティへ抽出
  - ユニットテスト追加

- [ ] 🔧 [M] **`Popup.tsx` のロジック分離**
  - `useSnooze` フックへ抽出
  - 早朝/週末/終了時間判定を `timeUtils.ts` と共通化

- [ ] 🔧 [S] `snoozeLogic.ts` にセクション見出しを追加（分割の前段階）

- [ ] 🔧 [L] `snoozeLogic.ts` の分割（上記整理後に実施）

#### ⚙️ システム改善

- [ ] 🔧 [L] **Functional Core / Imperative Shell パターンの導入**
  - 純粋ロジックと Chrome I/O を分離
  - `Date.now()` を依存注入化（テスト性向上）

- [ ] 🔧 [M] エラーハンドリングの統一 - ログレベル制御、通知の一元化

- [ ] 🔧 [S] `serviceWorker.ts` の再整理 - マジックナンバー排除、`checkPendingRecoveryNotification` 分離

- [ ] 🔧 [S] `serviceWorker.ts` の `clearAllSnoozedTabs` を専用メッセージハンドラ化

- [ ] 🔧 [S] 未使用importの整理 - `getSnoozedTabs` 等

### 💡 Low

#### 🐛 バグ・堅牢性

- [ ] 🐛 [S] 非同期処理中のアンマウント時 `setState` ガード追加（`Options`/`Popup`）

- [ ] 🐛 [S] キーボードショートカット無効化対象を拡張（`textarea`/`select`/`contenteditable`）

#### ✨ 機能改善

- [ ] ✨ [M] インポート時の重複タブデデュープ実装（キー: `url`+`popTime`）

#### 🧪 テスト改善

- [ ] 🧪 [M] `timeUtils.ts` のエッジケーステスト強化（日付またぎ、DST、不正入力）

- [ ] 🧪 [M] Reactコンポーネントのパフォーマンス/a11yレビュー（再レンダリング、focus管理、ARIA）

- [ ] 🧪 [S] `FailedTabsDialog` 統合テストのURL制御を `history.pushState` ベースに改善

- [ ] 🔧 [S] テスト用 `chrome` モック最小契約を `setup.ts` 近くに明記

---

### ✅ Done

- [x] 🔧 [L] **TypeScriptへの移行** (PR #103, #107, #108, #109, #110)
  - Phase 1-8 完了: インフラ → 型定義 → ユーティリティ → メッセージング → バックグラウンド → React → テスト → クリーンアップ (`allowJs: false`)

- [x] 🔧 [L] **V2一本化の完了** (PR #100, #101, #102)
  - StorageService V2対応、UI直接表示、Import/Export移動、レガシーコード撤去 (~430行削除)

- [x] 🐛 `snoozeLogic.ts` のタブ復元失敗時ロジック改善
  - リトライ（200ms×3回）、5分後再スケジュール、通知→FailedTabsDialog

- [x] 🔧 メッセージ契約の作成・接続（`messages.ts`）

- [x] 🔧 Chrome APIラッパー（`ChromeApi.ts`）

- [x] 🐛 V2サニタイズ時のversion保持

- [x] 🐛 schemaVersioningの配列検出

- [x] 🔧 `Options.tsx` の設定書き込みをメッセージ経由に変更

- [x] 🔧 `getSettings` の統合（`snoozeLogic.ts` → `timeUtils.ts`）

- [x] 🔧 `timeUtils.ts` のエラーハンドリング追加
