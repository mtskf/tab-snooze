# プロジェクトルール

- `pnpm` を使用
- TypeScript + ES Modules
- 外部API呼び出しは `try-catch` + リトライ処理
- テストでは外部APIを呼び出さず、モックを使用
- タスク完了時は dev-docs/ を必要に応じて更新
