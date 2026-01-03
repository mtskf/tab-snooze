# TODO

## Code review
- [x] 43d70666ca6b4fb77efa69b1f34203f0251c6d3b
- [x] 97d1e0d7c45a1d98dce785238b0c180842484aaf
- [ ] 127debfad7431005d3631940b43e0a137896258d
- [ ] 59222e5487d7b02deb3f5cebd13bfe46f1429a13
- [ ] 096dbf62f9914589555d2496226e0906bcea7223


## Known Issues

- [x] Medium: V2読み取り時のサニタイズ結果がストレージに永続化されないため、破損データが残り続ける（毎回サニタイズ/警告が発生する可能性）。
    - Resolved: `getValidatedSnoozedTabs` now saves sanitized data to storage.
- [x] Medium: V2サニタイズの単体テストが無いため、データ欠損やスケジュール欠落の回帰を検知できない。
    - Resolved: Added 9 tests for `validateSnoozedTabsV2` and `sanitizeSnoozedTabsV2`.
- [x] Medium: V2読み取り時の検証・サニタイズが未実装。`getValidatedSnoozedTabs`は未使用で、破損データがそのままUI/ロジックに流れる可能性がある。
    - Resolved: Implemented `sanitizeSnoozedTabsV2` and updated `getValidatedSnoozedTabs` to validate/sanitize on read.

## Refactoring Opportunities

- [ ] Medium: ストレージスキーマのマイグレーション整理。`snoooze_v2` のバージョン定義とマイグレーション表を追加し、検証/修復の入口を単一化して分散した補正ロジックを減らす。
- [ ] Medium: V2データモデルのJSDoc型定義と不変条件を明文化（`SnoozedItemV2`/`ScheduleV2`/`Settings`等）。スキーマ整理後に実施し、AI/人間の読み取り精度を上げる。
- [ ] Medium: `chrome.*` 直接アクセスの集約。`chrome.storage` / `chrome.tabs` / `chrome.alarms` を小さなAPIラッパー（例: `ChromeApi.js`）に集約し、エラーハンドリング・デフォルト値・テストモックを一元化する。
- [ ] Medium: メッセージ契約の集約。`action`名とrequest/responseの形を`messages.js`等に集約し、Popup/Options/Background間のコンテキストを一箇所で把握できるようにする。
- [ ] Medium: 定数の集約管理。`RESTRICTED_PROTOCOLS` や `STORAGE_LIMIT` などが散在しています。`src/utils/constants.js` に移動し、再利用性とメンテナンス性を向上させるべきです。
- [ ] Medium: Popupロジックの分離。`Popup.jsx` 内にあるスヌーズ実行やデータ取得ロジックをカスタムフック (`useSnooze.js` 等) に切り出し、ViewとLogicを分離することでテスト容易性を向上させます。
- [ ] Low: データフローの簡易ドキュメント化。`storage → background → UI`の流れ、スキーマの単一真実、主要ユースケースを`dev-docs/ARCHITECTURE.md`に明示セクションとしてまとめる。
- [ ] Low: エラーハンドリングの統一。`console.warn` / `error` の使い分けや、ユーザーへの通知（`chrome.notifications`）の仕組みを一箇所にまとめ、ログ出力レベルを制御できるようにします。
- [ ] Low: UIからドメインロジックを剥離。Popup/Optionsは背景へメッセージを送るだけにして、実処理はbackgroundに集約（UIからの複雑な状態更新を減らす）。
- [ ] Low: 重要フローの小さな統合テスト。`snooze → restore` の一連をChrome APIスタブで確認するテストを追加し、回帰バグを早期検知する。
- [ ] Low: `restoreTabs` のフラット化。ネストが深く（ループ内ループ内非同期処理）、可読性が低いです。上記「復元処理の統合」で不要になる可能性が高いです。
- [ ] Low: `snoozeLogic.js` の分割は優先度を下げる。ストレージ刷新と書き込み経路の一本化が先に必要で、今やると二度手間になりやすい。
