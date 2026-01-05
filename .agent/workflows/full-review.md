---
description: プロジェクトのコードとアーキテクチャを網羅的にレビューし、TODOリストを更新する
---

1. **ドキュメントの現状把握**
   プロジェクトの文脈と現状の課題を理解するために、以下のドキュメントを読み込みます。
   - `dev-docs/TODO.md` (現在のタスク状況)
   - `dev-docs/ARCHITECTURE.md` (想定アーキテクチャ)
   - `dev-docs/SPEC.md` (仕様)
   - `dev-docs/DECISIONS.md` (過去の技術選定)

   ```bash
   cat dev-docs/TODO.md dev-docs/ARCHITECTURE.md dev-docs/SPEC.md dev-docs/DECISIONS.md
   ```

2. **ソースコード構成の把握**
   プロジェクトの全体像とファイル構成を確認します。

   ```bash
   find src -not -path '*/.*'
   cat manifest.json
   ```

3. **詳細コードレビュー & 分析**
   各領域ごとにコード品質、アーキテクチャ違反、リファクタリングの機会を探ります。以下の観点でファイルを読み込み、分析してください。

   - **バックグラウンド処理 (`src/background`)**:
     - `snoozeLogic.js`, `serviceWorker.js` の肥大化確認。
     - V2ストレージ移行の完了状況。
     - エラーハンドリングの統一性。
   - **UI層 (`src/options`, `src/popup`)**:
     - ビジネスロジックがコンポーネントに漏れていないか。
     - 共通化できるフックやコンポーネントがないか。
   - **ユーティリティ (`src/utils`)**:
     - 純粋関数として保たれているか。
     - テスト容易性。
   - **テスト**:
     - `*.test.js` の存在確認とカバレッジの穴の特定。

   ```bash
   # 主要ロジックの確認
   grep -l "function" src/background/*.js src/utils/*.js

   # テストファイルの確認
   find src -name "*.test.js"
   ```

4. **分析結果とTODOの突き合わせ**
   前のステップでの分析結果と、現在の `dev-docs/TODO.md` を比較します。
   - 既にTODOにある項目は除外。
   - TODOにないが、修正・改善が必要な項目をリストアップ。

5. **TODOの更新**
   発見された新しいタスクを `dev-docs/TODO.md` に追加します。

   **更新ルール**:
   - `Priority`:
     - 🚨 High: バグ、セキュリティリスク、著しいパフォーマンス低下、リリースブロッカー
     - ⚠️ Medium: 可読性の著しい低下、将来的な負債、中規模なリファクタリング
     - 💡 Low: 軽微なクリーンアップ、最適化、Nice to have
   - `Type`: ✨ Feature | 🔧 Refactor | 🐛 Bug | ⚡ Performance | 📦 Infra
   - 既存の構造（Refactoring & Maintenanceなど）に合わせて適切なセクションに挿入する。

   ```bash
   # ファイルを編集してTODOを追加する（このステップはagentが実行）
   # edit_file dev-docs/TODO.md
   ```

6. **完了報告**
   - 新しく追加されたTODO項目。
   - コードベースの健全性に関する全体的な所感。
   - 次に取り組むべき推奨タスク。
