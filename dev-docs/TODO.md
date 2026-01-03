# TODO

## Priority
- 🚨: Critical / blocks release
- 🟡: Important / should fix soon
- 🟢: Nice to have / cleanup

## Refactoring & Maintenance (Priority Order)

1. [x] 🟡: V2ストレージ取得時に常にバリデーション/サニタイズする入口を用意（`getStorageV2` or shared accessor）。破損データで`items`/`schedule`が欠落した場合のクラッシュを防ぐ。
2. [x] 🟡: `DEFAULT_SETTINGS`準拠のフォールバックに統一（`timeUtils.getSettingsTime`の`9`、`Popup.parseTimeHour`の`8`を排除）。
3. [x] 🟡: デバッグ用の隠しコマンド（`jjj` 1分スヌーズ）を削除、または開発ビルド限定にする。
4. [x] 🟡: V2スキーマのバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化。
5. [ ] 🟡: JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
6. [ ] 🟡: メッセージ契約の集約（`messages.js` 等に `action`/request/response を定義）。
7. [ ] 🟡: `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
8. [ ] 🟡: ロジックの分離と共通化。
    - `Popup.jsx` の `parseTimeHour` を `timeUtils.js` へ移動。
    - `Popup` ロジックを `useSnooze` フックへ分離。
    - `timeUtils.getSettings()` を直接storage読取から排除し、呼び出し元から設定を注入する。
9. [ ] 🟡: `snoozeLogic.js`のタブ復元失敗時、リトライを繰り返すのではなく、ユーザーが手動で確認できる隔離リストに移動する。
10. [ ] 🟡: Reactコンポーネント（`Popup.jsx`, `Options.jsx`, `SnoozedList.jsx`）のパフォーマンス（再レンダリング）、アクセシビリティ、ベストプラクティスをレビューする。
11. [ ] 🟡: ユーティリティファイル（`timeUtils.js`, `uuid.js`）を詳細にレビューし、改善の余地がないか確認する。
12. [ ] 🟢: データフローを`ARCHITECTURE.md`に明示セクション化。
13. [ ] 🟢: エラーハンドリングの統一（ログレベル制御、通知の一元化）。
14. [ ] 🟢: `snoozeLogic.js` の分割（スキーマ整理後に実施）。
15. [ ] 🟢: 未使用importの整理（Options/Popupなど）。
16. [ ] 🟢: `serviceWorker.js`の`clearAllSnoozedTabs`アクションで、専用の`clearAll`メッセージハンドラを使い、V2ストアを直接クリアするようリファクタリングする。
