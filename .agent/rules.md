# プロジェクトルール

Chrome拡張機能（Manifest V3）- タブをスヌーズして後で復元

## 開発

- TypeScript + ES Modules
- 外部API呼び出しは `try-catch` + リトライ処理
- タスク完了時は dev-docs/ を更新

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm test` | テスト実行 |
| `npm run typecheck` | 型チェック |

## ドキュメント (dev-docs/)

| ファイル | 内容 |
|---------|------|
| SPEC.md | 機能仕様（ビジネスロジック） |
| ARCHITECTURE.md | アーキテクチャ・データモデル |
| DECISIONS.md | 設計判断の記録 |
| LESSONS.md | 学んだ教訓 |
