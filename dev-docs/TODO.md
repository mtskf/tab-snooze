# TODO

## Refactoring & Maintenance (Priority Order)

1. [x] Medium: V2ストレージ取得時に常にバリデーション/サニタイズする入口を用意（`getStorageV2` or shared accessor）。破損データで`items`/`schedule`が欠落した場合のクラッシュを防ぐ。
2. [x] Medium: `DEFAULT_SETTINGS`準拠のフォールバックに統一（`timeUtils.getSettingsTime`の`9`、`Popup.parseTimeHour`の`8`を排除）。
3. [x] Medium: デバッグ用の隠しコマンド（`jjj` 1分スヌーズ）を削除、または開発ビルド限定にする。
4. [ ] Medium: V2スキーマのバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化。
5. [ ] Medium: JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
6. [ ] Medium: `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
7. [ ] Medium: ロジックの分離と共通化。
    - `Popup.jsx` の `parseTimeHour` を `timeUtils.js` へ移動。
    - `Popup` ロジックを `useSnooze` フックへ分離。
    - `timeUtils.getSettings()` を直接storage読取から排除し、呼び出し元から設定を注入する。
8. [ ] Low: メッセージ契約の集約（`action`名とrequest/responseを`messages.js`等に）。
9. [ ] Low: データフローを`ARCHITECTURE.md`に明示セクション化。
10. [ ] Low: エラーハンドリングの統一（ログレベル制御、通知の一元化）。
11. [ ] Low: `snoozeLogic.js` の分割（スキーマ整理後に実施）。
12. [ ] Low: 未使用importの整理（Options/Popupなど）。
