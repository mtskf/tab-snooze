# TODO

## Known Issues

None currently tracked.

## Refactoring Opportunities (Priority Order)

1. [x] Medium: 設定取得の経路を統一（Popup/Optionsともに背景API経由でデフォルトをマージした設定を受け取る）。 ✅ ✅
2. [ ] Medium: V2スキーマのバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化。
3. [ ] Medium: JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
4. [ ] Medium: `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
5. [ ] Medium: ロジックの分離と共通化。
    - `Popup.jsx` の `parseTimeHour` を `timeUtils.js` へ移動。
    - `Popup` ロジックを `useSnooze` フックへ分離。
6. [ ] Low: メッセージ契約の集約（`action`名とrequest/responseを`messages.js`等に）。
7. [ ] Low: データフローを`ARCHITECTURE.md`に明示セクション化。
8. [ ] Low: エラーハンドリングの統一（ログレベル制御、通知の一元化）。
9. [ ] Low: `snoozeLogic.js` の分割（スキーマ整理後に実施）。
