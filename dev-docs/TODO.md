# TODO

## Priority
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

## Refactoring & Maintenance

### 🟡 Important
1. [ ] メッセージ契約の集約（`messages.js` 等に `action`/request/response を定義）。
2. [ ] `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
3. [ ] ロジックの分離と共通化。
   - `Popup` ロジックを `useSnooze` フックへ分離。
   - `timeUtils.getSettings()` を直接storage読取から排除し、呼び出し元から設定を注入する。
4. [x] JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
5. [ ] `snoozeLogic.js`のタブ復元失敗時、リトライを繰り返すのではなく、ユーザーが手動で確認できる隔離リストに移動する。
6. [ ] Reactコンポーネント（`Popup.jsx`, `Options.jsx`, `SnoozedList.jsx`）のパフォーマンス（再レンダリング）、アクセシビリティ、ベストプラクティスをレビューする。
7. [ ] ユーティリティファイル（`timeUtils.js`, `uuid.js`）を詳細にレビューし、改善の余地がないか確認する。

### 🟢 Nice to Have
1. [ ] データフローを`ARCHITECTURE.md`に明示セクション化。
2. [ ] エラーハンドリングの統一（ログレベル制御、通知の一元化）。
3. [ ] `snoozeLogic.js` の分割（スキーマ整理後に実施）。
4. [ ] 未使用importの整理（Options/Popupなど）。
5. [ ] `serviceWorker.js`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。
