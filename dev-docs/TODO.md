# TODO

## Priority
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

## Refactoring & Maintenance

### 🟡 Important
1. [ ] メッセージ契約の集約（`messages.js` に `action` 定数/バリデーション/ハンドラ紐付けを定義。型は `src/types.js` を参照）。
2. [ ] `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
3. [ ] Functional Core / Imperative Shell に分離（純粋ロジックと `chrome` I/O を分けてテスト容易性を上げる）。
4. [ ] UIはV2直表示へ移行（selector層を作り、V1アダプタは import/export のみに限定）。
5. [ ] Clock/Now の依存注入（`Date.now()` 直呼び排除でテスト性/再現性を向上）。
6. [ ] Popupのロジック分離と共通化。
   - `Popup` ロジックを `useSnooze` フックへ分離。
   - `timeUtils.getSettings()` を直接storage読取から排除し、呼び出し元から設定を注入する。
7. [ ] `snoozeLogic.js`のタブ復元失敗時、リトライを繰り返すのではなく、ユーザーが手動で確認できる隔離リストに移動する。
8. [ ] Reactコンポーネント（`Popup.jsx`, `Options.jsx`, `SnoozedList.jsx`）のパフォーマンス/アクセシビリティ/ベストプラクティスを、具体的観点（再レンダリングの原因、focus管理、ARIA）でレビューする。
9. [ ] ユーティリティ（`timeUtils.js`, `uuid.js`）の改善余地を観点ベースでレビューする（API表面、境界値、テスト欠落）。
10. [ ] Claude CodeのコミットをCodexで自動レビューするよう導線を整備（post-commitフック + `tools/codex-review.sh` でレビュー生成→クリップボード送信）。

### 🟢 Nice to Have
1. [ ] データフローを`ARCHITECTURE.md`に明示セクション化。
2. [ ] エラーハンドリングの統一（ログレベル制御、通知の一元化）※`ChromeApi`導入後に実施。
3. [ ] `snoozeLogic.js` の分割（スキーマ整理後に実施）。
4. [ ] 未使用importの整理（Options/Popupなど）。
5. [ ] `serviceWorker.js`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。

### Done
1. [x] JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
