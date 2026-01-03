# TODO

## Known Issues

None currently tracked.

## Refactoring Opportunities (Priority Order)

1. [ ] Medium: V2スキーマのバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化。
2. [ ] Medium: JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
3. [ ] Medium: `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
4. [ ] Medium: ロジックの分離と共通化。
    - `Popup.jsx` の `parseTimeHour` を `timeUtils.js` へ移動。
    - `Popup` ロジックを `useSnooze` フックへ分離。
5. [ ] Low: メッセージ契約の集約（`action`名とrequest/responseを`messages.js`等に）。
6. [ ] Low: データフローを`ARCHITECTURE.md`に明示セクション化。
7. [ ] Low: エラーハンドリングの統一（ログレベル制御、通知の一元化）。
8. [ ] Low: `snoozeLogic.js` の分割（スキーマ整理後に実施）。
9. [x] Low: `useKeyboardNavigation` と Popup/Options 表示ロジックのテストを追加してUI周辺の低カバレージを改善。 ✅
