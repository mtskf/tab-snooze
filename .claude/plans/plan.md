# V2一本化 実装計画

## 概要

UIとStorageServiceをV2形式に統一し、V1アダプタをimport時の後方互換のみに限定する。

## 設計方針

- **StorageService**: ファイルI/OとJSON整形のみ（移行/検証/マージは背景側）
- **Selectors**: V2生データのみを入力、UI側はuseMemoで1回だけ変換
- **SnoozedList**: 表示専用（変換済みデータを受け取る）

## V1混入時の処理責務

V1データが混入しても、背景側で必ずV2に変換される:
- **initStorage()**: 起動時にV1→V2マイグレーション実行
- **setSnoozedTabs()**: `detectSchemaVersion()` + `runMigrations()` で必ずV2化
- **importTabs()** (Phase 2で追加): 同上

UIは常にV2のみを扱う前提で設計。

---

## Phase 1: Selector層の追加 + UIをV2直接表示へ移行

**ブランチ**: `refactor/ui-v2-direct`

このPhaseでV1→V2のUI移行を一気に完了させ、V1/V2両対応期間を作らない

### 変更ファイル
- `src/messages.js` - `GET_SNOOZED_TABS_V2` 追加
- `src/background/snoozeLogic.js` - `getSnoozedTabsV2()` export
- 新規: `src/utils/selectors.js`
- 新規: `src/utils/selectors.test.js`
- `src/options/Options.jsx`
- `src/options/Options.test.jsx`
- `src/options/SnoozedList.jsx`
- `src/options/SnoozedList.test.jsx`
- `src/utils/StorageService.js` - `exportTabs()` V2対応
- `src/utils/StorageService.test.js`

### 作業内容

#### 1-1. V2直接取得API追加（検証済みデータを返す）
```javascript
// messages.js
MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2 = 'getSnoozedTabsV2'

// snoozeLogic.js - getValidatedSnoozedTabs()のV2版
// 既存のgetValidatedSnoozedTabs()は検証後にadapterV1()でV1変換している
// V2版は検証後にV2のまま返す
export async function getSnoozedTabsV2() {
  const v2Data = await getStorageV2();
  const validation = validateSnoozedTabsV2(v2Data);

  if (!validation.valid) {
    const sanitized = sanitizeSnoozedTabsV2(v2Data);
    await saveStorageV2({ ...sanitized, version: 2 });
    return { ...sanitized, version: 2 };
  }

  return v2Data;
}
```

#### 1-2. Selector関数の作成（V2生データ入力固定）
```javascript
// src/utils/selectors.js
// 全て V2生データ { version, items, schedule } を入力とする

// V2 → V2 (フィルタリング)
export function filterByQuery(v2Data, query) { ... }    // → V2

// V2 → 表示用 (最終変換)
export function selectSnoozedItemsByDay(v2Data) { ... }  // → DayGroup[]
export function selectTabCount(v2Data) { ... }          // → number

// 呼び出し順序 (テストで固定):
// 1. filterByQuery(v2Data, query)  → filtered V2
// 2. selectSnoozedItemsByDay(filtered) → DayGroup[]

// テスト条件:
// - filterByQuery後のV2はitems/scheduleの整合性を保つ
//   (scheduleに存在するIDは必ずitemsに存在する)
```

#### 1-3. Options.jsx の変更
- `GET_SNOOZED_TABS` → `GET_SNOOZED_TABS_V2`
- state: `snoozedTabs` (V1) → `snoozedData` (V2)
- `useMemo` でセレクター呼び出し（1回だけ変換）
- **Export を V2 化**: `StorageService.exportTabs(snoozedData)` で V2 形式ダウンロード
- **Import も V2 受け入れ**: parseImportFile がV1/V2両対応に（マージはPhase 2で修正）

#### 1-4. StorageService.js の変更（Export/Import V2対応）
```javascript
// Export: V2形式を受け取りJSONダウンロード
exportTabs: (v2Data) => {
  if (!v2Data?.items || Object.keys(v2Data.items).length === 0) {
    throw new Error("No tabs to export.");
  }
  const jsonData = JSON.stringify(v2Data, null, 2);
  // ...download logic (既存のまま)
}

// Import: V1/V2両対応（最低限）
parseImportFile: (file) => {
  // JSONパース
  const data = JSON.parse(e.target.result);

  // バージョン判定
  const version = detectSchemaVersion(data);

  if (version === 2) {
    // V2: validateSnoozedTabsV2で検証
    const validation = validateSnoozedTabsV2(data);
    if (!validation.valid) {
      return { ...sanitizeSnoozedTabsV2(data), version: 2 };
    }
    return data;
  } else {
    // V1: 既存ロジック
    const validation = validateSnoozedTabs(data);
    if (!validation.valid && !validation.repairable) {
      throw new Error("Invalid data");
    }
    if (!validation.valid) {
      return sanitizeSnoozedTabs(data);
    }
    return data;
  }
}
```

**Phase 1のImport挙動（V1/V2統一）**:
- **全て上書き**: 既存データを置換（マージなし）
- **確認ダイアログ必須**:
  - 「既存データを上書きします。自動バックアップは保証されないため、事前にエクスポートしてください。」
  - 「上書き/キャンセル」ボタン
  - キャンセル時: ファイル入力をクリア（テスト対象）
- **バックアップ**: Phase 1では既存の`rotateBackups`に依存（上書き前の確実な保持は保証されない）
  - Phase 2で`importTabs()`に「上書き前バックアップ」を追加
- **マージ機能はPhase 2でバックグラウンドに実装**

#### 1-5. SnoozedList.jsx の変更
- Props: `snoozedTabs` (V1) → `dayGroups` (変換済み配列)
- 内部変換ロジック削除（表示専用に徹底）

---

## Phase 2: Import/Exportをバックグラウンドへ集約

**ブランチ**: `refactor/import-export-background`

### 変更ファイル
- `src/messages.js`
- `src/background/snoozeLogic.js`
- `src/background/snoozeLogic.test.js`
- `src/options/Options.jsx`
- `src/utils/StorageService.js`
- `src/utils/StorageService.test.js`

### 作業内容

#### 2-1. バックグラウンドにImport/Export集約
```javascript
// snoozeLogic.js
export async function importTabs(rawData) {
  // 0. 上書き前バックアップを取得
  // 1. バージョン検出 (detectSchemaVersion)
  // 2. V1なら runMigrations() でV2に変換
  // 3. validateSnoozedTabsV2 / sanitizeSnoozedTabsV2
  // 4. 現在データとマージ（ID衝突時は新UUID生成）
  // 5. saveStorageV2
  return { success, addedCount };
}

export async function getExportData() {
  return await getSnoozedTabsV2();
}
```

#### 2-2. StorageServiceをファイルI/Oのみに限定
```javascript
// StorageService.js - シンプル化
export const StorageService = {
  // JSONをファイルとしてダウンロード
  downloadAsJson(data, filename) { ... },

  // ファイルをJSONとして読み込み（パースのみ、検証なし）
  readJsonFile(file) { ... }
};
```

#### 2-3. Options.jsx の変更
```javascript
// Import: ファイル読み込みはUI、処理は背景に委譲
const handleImport = async (file) => {
  const rawData = await StorageService.readJsonFile(file);
  const result = await sendMessage(MESSAGE_ACTIONS.IMPORT_TABS, { data: rawData });
  // 結果表示
};

// Export: 背景からデータ取得、ダウンロードはUI
const handleExport = async () => {
  const data = await sendMessage(MESSAGE_ACTIONS.EXPORT_TABS);
  StorageService.downloadAsJson(data, 'snoooze-export.json');
};
```

#### 2-4. テスト戦略
- `snoozeLogic.test.js`: importTabs() V1/V2両対応、V2マージロジック
- `StorageService.test.js`: readJsonFile/downloadAsJsonのモックテスト
  - Phase 1で追加したparseImportFileのV2テストは削除（readJsonFileに置換）
- `Options.test.jsx`: sendMessage呼び出しのモックテスト、確認ダイアログ

---

## Phase 3: V1レガシーコード撤去

**ブランチ**: `refactor/remove-v1-legacy`

### 削除対象
| ファイル | 削除内容 |
|---------|---------|
| `snoozeLogic.js` | `adapterV1()`, 旧 `getSnoozedTabs()` |
| `validation.js` | `validateSnoozedTabs()`, `sanitizeSnoozedTabs()` (V1用) |
| `StorageService.js` | 旧V1メソッド群 (`exportTabs`, `parseImportFile`, `mergeTabs`) |
| `messages.js` | `GET_SNOOZED_TABS` (V1版) |

### 残すもの
- `schemaVersioning.js` の `migrateV1toV2()` - import時の後方互換用

---

## 依存関係

```
Phase 1 ──> Phase 2 ──> Phase 3
```

- 各Phaseは順次実行（V1/V2両対応期間を作らない）
- Phase 1完了時点でUIはV2のみ使用
- Phase 2完了時点で移行/検証/マージは背景に集約
- Phase 3で不要コードを削除

---

## 各Phaseの完了条件

- [ ] Phase 1:
  - selectors.test.js: V2入力→表示用変換、filterByQuery後のitems/schedule整合性
  - StorageService.test.js: exportTabs V2、parseImportFile V1/V2両対応
  - Options.test.jsx: 確認ダイアログ、キャンセル時のファイル入力クリア
  - SnoozedList.test.jsx, messages.test.js 全パス
- [ ] Phase 2:
  - snoozeLogic.test.js: importTabs V1/V2両対応、V2マージ
  - StorageService.test.js: parseImportFileテスト削除、readJsonFile/downloadAsJsonテスト追加
  - import/export 動作確認
- [ ] Phase 3: 全テストパス、lint通過、V1コード削除完了
