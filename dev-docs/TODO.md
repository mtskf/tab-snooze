# TODO & Refactoring Roadmap

This document outlines the roadmap for refactoring and maintenance, organized by strategic epics.

## Priority Legend
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

---

### **エピック1: 基盤整備 (アーキテクチャ分離とテスト容易性向上)**
This epic is the most critical foundation for improving the application's robustness and testability. Many subsequent tasks depend on its completion.

1.  [ ] 🟡 **`chrome.*` APIラッパーの接続:** 既存の `ChromeApi.js` を実運用に接続し、`chrome` 直呼びを段階的に置換する。
2.  [ ] 🟡 **Clock/Nowの依存性注入:** `Date.now()` の直接呼び出しを排除し、時刻を外部から注入可能にすることで、テストの再現性を確保する。
3.  [ ] 🟡 **Functional Core / Imperative Shellへの分離:** 上記2点を包含する設計思想。純粋なビジネスロジックと、API呼び出しのような副作用を持つ部分を明確に分離する。
4.  [ ] 🟡 **メッセージ契約の接続:** 既存の `messages.js`（`MESSAGE_ACTIONS`/`dispatchMessage`/`sendMessage`）を service worker / UI に適用し、手書き switch と直送信を置換する。
5.  [ ] 🟢 **エラーハンドリングの統一:** APIラッパー導入後、ログレベル制御や通知を一元的に管理する。

---

### **エピック2: UIリファクタリング**
This epic focuses on clarifying the responsibilities of UI components and aligning them with the modern V2 data structure.

6.  [ ] 🟡 **Popupロジックの分離:** `Popup.jsx` の複雑なロジックを `useSnooze` のようなカスタムフックに分離し、UIとロジックを分離する。
7.  [ ] 🟡 **UIのV2ネイティブ化:** `useSnooze`フック分離後、UIが直接 `V2` データ形式を扱えるように修正し、バックグラウンドの `adapterV1` 層を撤廃する。
8.  [ ] 🟡 **コンポーネントレビュー:** パフォーマンス（再レンダリング）、アクセシビリティ（Focus管理, ARIA）の観点で主要コンポーネントをレビューする。

---

### **エピック3: バックグラウンド処理の改善**
This epic aims to make the background logic safer and more maintainable.

9.  [ ] 🟢 **`snoozeLogic.js`の分割:** 責務が肥大化した `snoozeLogic.js` を、機能ごと（ストレージ、バックアップ、復元など）に分割する。
10. [ ] 🟡 **V2サニタイズ時のversion保持:** `getValidatedSnoozedTabs`/`recoverFromBackup` のサニタイズ保存で `version` が消えるため、保存前に必ず付与する。
11. [ ] 🟡 **schemaVersioningの配列検出:** `detectSchemaVersion` が配列をV1扱いするため、配列は無効として弾く。
12. [ ] 🟡 **タブ復元失敗時の処理改善:** 復元に失敗したタブを隔離リストに移動し、無限リトライを防ぐ。
13. [ ] 🟢 **`clearAll`アクションの明確化:** 全件削除のアクションを、より直接的で分かりやすい実装に修正する。

---

### **エピック4: ドキュメントと開発ツール**
Tasks to improve the developer experience.

14. [ ] 🟢 **データフローのドキュメント化:** `ARCHITECTURE.md` にデータフロー図を追加する。
15. [ ] 🟢 **未使用importの整理:** リンターを活用して不要なimportを削除する。
16. [ ] 🟡 **ユーティリティのレビュー:** `timeUtils.js` などをレビューし、API設計や境界値テストの改善点を探す。
17. [ ] 🟡 **自動レビューツールの整備:** post-commitフックなどを活用した開発フローを整備する。

---

### **長期的刷新案 (Future Vision)**
A major architectural shift to consider for the long term.

18. [ ] 🟢 **中央集権的な状態管理の導入:** 将来的な選択肢として、Zustand等を導入し、UI-バックグラウンド間の手動メッセージングを撤廃する。
