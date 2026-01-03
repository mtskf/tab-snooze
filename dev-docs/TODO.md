# TODO

## Code review
- [x] 43d70666ca6b4fb77efa69b1f34203f0251c6d3b
- [ ] 97d1e0d7c45a1d98dce785238b0c180842484aaf


## Known Issues


## Refactoring Opportunities

- [ ] Medium: 定数の集約管理。`RESTRICTED_PROTOCOLS` や `STORAGE_LIMIT` などが散在しています。`src/utils/constants.js` に移動し、再利用性とメンテナンス性を向上させるべきです。
- [ ] Medium: Popupロジックの分離。`Popup.jsx` 内にあるスヌーズ実行やデータ取得ロジックをカスタムフック (`useSnooze.js` 等) に切り出し、ViewとLogicを分離することでテスト容易性を向上させます。
- [ ] Low: エラーハンドリングの統一。`console.warn` / `error` の使い分けや、ユーザーへの通知（`chrome.notifications`）の仕組みを一箇所にまとめ、ログ出力レベルを制御できるようにします。
- [ ] Low: `restoreTabs` のフラット化。ネストが深く（ループ内ループ内非同期処理）、可読性が低いです。上記「復元処理の統合」で不要になる可能性が高いです。
- [ ] Low: `snoozeLogic.js` の分割は優先度を下げる。ストレージ刷新と書き込み経路の一本化が先に必要で、今やると二度手間になりやすい。
