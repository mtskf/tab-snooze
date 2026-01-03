# TODO

## Commits to review

- [ ] af322355f627c17b63eeb317eab91cdc17394bc5
- [x] 0e5b3fdbb4299b70534696e5bf3259daa7830ea9 ✅

## Known Issues

None currently tracked.

## Refactoring Opportunities

### High Priority (Next Sprint)
- [ ] Medium: 定数の集約管理。`RESTRICTED_PROTOCOLS`, `STORAGE_LIMIT`, `BACKUP_*` 等を `src/utils/constants.js` へ移動。

### Medium Priority (Backlog)
- [ ] Medium: V2スキーマのバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化。
- [ ] Medium: JSDoc型定義（`SnoozedItemV2`, `ScheduleV2`, `Settings`等）を追加。
- [ ] Medium: `chrome.*` APIラッパー（`ChromeApi.js`）に集約。エラーハンドリング・テストモックを一元化。
- [ ] Medium: メッセージ契約の集約（`action`名とrequest/responseを`messages.js`等に）。
- [ ] Medium: Popupロジックをカスタムフック（`useSnooze.js`）に分離。

### Low Priority (Nice to Have)
- [ ] Low: データフローを`ARCHITECTURE.md`に明示セクション化。
- [ ] Low: エラーハンドリングの統一（ログレベル制御、通知の一元化）。
- [ ] Low: `snooze → restore` の統合テスト追加。
- [ ] Low: `restoreTabs` のネストをフラット化（可読性向上）。
- [ ] Low: `snoozeLogic.js` の分割（スキーマ整理後に実施）。
