# TODO

## Code review
- [x] b00cd1e73fc464b39500cbfff399ea34973d52a6
- [x] b5b447c3632f7d0a56e26830eaba1235c29b68eb
- [x] b96ab912eb87e83da330744ebd018c0dcf9726d9
- [x] fa2a3f78a1f873e08a71871f5ecd59cd381fc67c
- [x] 5f16cf5748725beaa57ffe9250348285cb79abc0
- [x] d2ae50325f9432e58f317a0c6be1271b6b5aded4
- [x] fe7495b165fc633f3ecda21d3054c83e2f69e8a2
- [x] 73bc456d177a30f24aebe16ce8ef2e512e38bcac
- [x] 1a6bc647f3b18bb2a67cb23ca8023ccd341c6653

## Simplification Opportunities

- [ ] Medium: `Options.jsx` の Import/Export ロジック分離。ファイル読み込み、JSONパース、バリデーションロジックがコンポーネント内にあり、肥大化しています。これらを `StorageService.js` 等に移動し、UIは「呼び出すだけ」にシンプル化すべきです。

## Refactoring Opportunities
- [ ] Medium: 定数の集約管理。`RESTRICTED_PROTOCOLS` や `STORAGE_LIMIT` などが散在しています。`src/utils/constants.js` に移動し、再利用性とメンテナンス性を向上させるべきです。
- [ ] Medium: Popupロジックの分離。`Popup.jsx` 内にあるスヌーズ実行やデータ取得ロジックをカスタムフック (`useSnooze.js` 等) に切り出し、ViewとLogicを分離することでテスト容易性を向上させます。
- [ ] Low: `restoreTabs` のフラット化。ネストが深く（ループ内ループ内非同期処理）、可読性が低いです。上記「復元処理の統合」で不要になる可能性が高いです。
- [ ] Low: エラーハンドリングの統一。`console.warn` / `error` の使い分けや、ユーザーへの通知（`chrome.notifications`）の仕組みを一箇所にまとめ、ログ出力レベルを制御できるようにします。
- [ ] Low: `snoozeLogic.js` の分割は優先度を下げる。ストレージ刷新と書き込み経路の一本化が先に必要で、今やると二度手間になりやすい。
