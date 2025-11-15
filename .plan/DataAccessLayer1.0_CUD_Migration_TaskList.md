# DataAccessLayer 1.0 – CUD & Migration Feature Task List
_For AI agents implementing new functionality in rawsql-ts_

このドキュメントは、既存の「SELECT テストツール」だけを持つ状態から、  
**CUD（INSERT/UPDATE/DELETE）対応**と**マイグレーション機能（AST diff ベース）**を追加実装していくためのタスクリストです。

AIエージェントが実装を進める際の「やることリスト」として利用してください。

---

## フェーズ0：前提整理タスク（現状ライブラリの把握）

### 0-1. 既存「SELECTテストキット」機能のインベントリ取得

**目的**  
既存の R(SELECT) テスト機能と、これから作る CUD/マイグレ機能との境界を明確にする。

**指示（AI向け）**

- 既存パッケージ構成・主要クラス・public API を一覧化する。
- 「CTEインジェクション」「AST解析」「テストDSL」など、再利用できる部品をリストアップする。

**アウトプット**

- SELECTテスト機能の構造図（簡易でOK）  
- 再利用予定モジュールのリスト＋簡単な説明

---

## フェーズ1：CUD 用の基盤機能

### 1-1. TableDef / Schema 定義モデルの最小実装

**目的**  
CUD 正規化時に使う「テーブル定義スナップショット」をコードとして表現する。

**指示**

- TypeScriptで `TableDef<Row>` の型を設計する：
  - `tableName: string`
  - `columns`: name, dbType, nullable, defaultExpr など
  - `primaryKey`: カラム名配列
- 単純な例用に `UsersTable`, `CustomersTable` などのモック定義を作る。

**制約**

- DB抽象型は作らない。Postgresなら `text`, `uuid`, `jsonb` など DB の型名をそのまま使う。

**アウトプット**

- `TableDef` 型定義
- サンプルテーブル定義ファイル（1〜2個）

---

### 1-2. INSERT … VALUES → INSERT … SELECT 正規化ユーティリティ

**目的**  
すべての INSERT を「INSERT … SELECT」ルートに統一する。

**指示**

- rawsql-ts の AST 型を前提にした関数を実装する：
  - 入力: `InsertStatementAst`
  - 出力: `InsertStatementAst`（VALUES があれば SELECT に変換済み）
- 変換仕様：
  - `insert into t (a,b) values ($1,$2)` →  
    `insert into t (a,b) select * from (values ($1,$2)) as v(a,b)`
  - 複数行 `VALUES` にも対応する。

**テスト**

- パラメータあり / 複数行 VALUES / 列名省略ケースを含むユニットテストを作る。

**アウトプット**

- `normalizeInsertValuesToSelect(ast: InsertStatementAst): InsertStatementAst`
- 対応するテストコード

---

### 1-3. Payload SELECT に型CASTを適用するユーティリティ

**目的**  
`TableDef` に基づき、トップレベルSELECTに DB 型 CAST を強制する。

**指示**

- 関数シグネチャ案：
  ```ts
  function applyTypeCastsToSelect(
    payloadSelectAst: SelectStatementAst,
    tableDef: TableDef<any>,
  ): SelectStatementAst;
  ```
- 動作：
  - SELECTの各列を `CAST(expr AS <dbType>) AS colName` に変換する。
  - SELECT列名を `tableDef.columns` と突き合わせる。
  - 見つからない列や余剰列があれば、エラー or Issue リストを返す仕組みを用意する（例: `ValidationError`）。

**テスト**

- 正常系（全列マッチ）
- 不足列 / 余剰列 / 型名の差異 を含むケース

**アウトプット**

- `applyTypeCastsToSelect` 実装
- テストコード

---

### 1-4. CUD 構造検証（静的バリデーション）モジュール

**目的**  
DB を叩く前に、AST＋TableDef だけで CUD の妥当性をチェックする。

**指示**

- バリデーション項目：
  - ターゲットテーブル名が `TableDef.tableName` と一致しているか。
  - `INSERT` の列リストが `TableDef.columns` に存在するか。
  - `NOT NULL & defaultなし` の列が、ペイロード SELECT で提供されているか。
- API案：
  ```ts
  type CudValidationIssue =
    | { kind: 'MissingColumn'; column: string; message: string }
    | { kind: 'ExtraColumn'; column: string; message: string }
    | { kind: 'RequiredColumnMissing'; column: string; message: string };

  function validateInsertShape(
    insertAst: InsertStatementAst,
    tableDef: TableDef<any>,
  ): CudValidationIssue[];
  ```

**アウトプット**

- `validateInsertShape` 実装
- ユニットテスト

**備考**

- 後で UPDATE/DELETE 用の検証も追加しやすいよう、内部構造は拡張性を意識する。

---

### 1-5. 「DTO SELECT 実行による動的チェック」API

**目的**  
FROM句なし SELECT を実行して、null / 型エラーといった実行時問題を拾えるようにする。

**指示**

- API案：
  ```ts
  type DtoSelectValidationOptions = {
    table: TableDef<any>;
    selectSql: string;      // FROMなしDTO SELECT
    params: unknown[];
    dbAdapter: DbAdapter;   // 既存の抽象DBアダプタ
  };

  type DtoSelectValidationResult = {
    issues: Array<{
      kind: 'NullOnNotNullColumn' | 'DbTypeError';
      column: string;
      message: string;
    }>;
  };

  async function validateDtoSelectRuntime(
    options: DtoSelectValidationOptions,
  ): Promise<DtoSelectValidationResult>;
  ```
- 動作：
  - DTO SELECT をそのまま実行（1行想定）。
  - `TableDef` 上 NOT NULL な列に `null` が返れば issue 追加。
  - CAST 失敗や DBの型エラーも issue として報告。

**制約**

- 物理テーブルを前提としない。FROMなしSELECTで完結させる。

**アウトプット**

- `validateDtoSelectRuntime` 実装
- テストコード（テスト用DB or モック）

---

### 1-6. TestkitDbAdapter の `execute` 拡張（CUDインターセプト）

**目的**  
既存の `query` (SELECT) テストキットに、CUD も同じアダプタで扱えるようにする。

**指示**

- 既存 `TestkitDbAdapter` を拡張し、`execute(sql, params)` を CUD 対応にする：
  - `sql` を AST パース。
  - INSERT/UPDATE/DELETE の場合のみ CUD パイプラインへ流す。
- INSERT フローの例：
  1. AST パース
  2. `normalizeInsertValuesToSelect`
  3. `applyTypeCastsToSelect`
  4. `validateInsertShape`
  5. 必要に応じて `validateDtoSelectRuntime`
  6. 設定に応じて：
     - a. 実DBには投げない（不変テストモード）
     - b. テスト用DBにだけ投げる

**アウトプット**

- 拡張された `TestkitDbAdapter` 実装
- CUD を含むテストケース

---

## フェーズ2：テスト DSL / API の統一

### 2-1. R/CUD 共通の「リポジトリテストDSL」の設計

**目的**  
開発者が SELECT/CUD を同じ感覚でテスト書けるようにする。

**指示**

- DSL案：
  ```ts
  scenario('insert customer', ({ givenTable, whenExecute, expectIssues }) => {
    givenTable(CustomersTable, [
      // optional: before state for reads
    ]);

    whenExecute(async (repo) => {
      await repo.insertCustomer(dto);
    });

    expectIssues([]); // CUD構造・runtime検証の issue が空であることを確認
  });
  ```
- 最初は「issue が空であること」を検証するだけでもよい。

**アウトプット**

- 最小限のテストDSL実装
- サンプルテスト（SELECT + INSERT）

---

## フェーズ3：スキーマスナップショット & マイグレ差分

### 3-1. DB から Schema Snapshots を生成する CLI

**目的**  
開発者ごとのローカルスキーマ定義ファイルを、実DBから逆生成する。

**指示**

- `rawsql-ts schema pull` 的なCLIコマンドを作る。
- まずは Postgres 対応から始める。
- `information_schema` や `pg_catalog` を用いて:
  - テーブル名
  - カラム名
  - 型
  - null許可
  - default
  などを取得し、`TableDef` or DDL AST に変換してファイル出力する。

**アウトプット**

- 小さな CLI パッケージ（例: `packages/schema-cli`）
- サンプル出力ファイル

---

### 3-2. Schema AST モデル & ローダ

**目的**  
本番スキーマとローカルスキーマを同じ AST 形式で扱えるようにする。

**指示**

- DDL AST の最小モデルを定義：
  - `CreateTableAst`
  - `ColumnDefAst`
  - `ConstraintAst`（PK/UK/FK/チェック など必要な範囲）
- ローカルのスキーマ定義ファイル（TableDef or DDL）から、この AST を構築するローダを実装する。

**アウトプット**

- `SchemaAst` モデル
- `loadLocalSchema()` 実装

---

### 3-3. スキーマ AST diff エンジン

**目的**  
「今の本番 vs ローカル理想」の差分を意味レベルで比較する。

**指示**

- 関数案：
  ```ts
  type SchemaDiff =
    | { kind: 'CreateTable'; table: string; /* ... */ }
    | { kind: 'AddColumn'; table: string; column: string; /* ... */ }
    | { kind: 'AlterColumnType'; table: string; column: string; /* ... */ }
    | { kind: 'AddConstraint'; table: string; constraint: string; /* ... */ }
    // など


  function diffSchema(current: SchemaAst, desired: SchemaAst): SchemaDiff[];
  ```
- 対応する差分から順番に実装（まずは簡単なケースから）：
  - 新規テーブル
  - 列追加
  - 列型変更
  - NOT NULL追加
  - DEFAULT追加
  - 制約追加 など

**アウトプット**

- `diffSchema` 実装
- ユニットテスト

---

### 3-4. SchemaDiff → DDL 生成

**目的**  
AST差分から実行可能なマイグレDDLスクリプトを出す。

**指示**

- 関数案：
  ```ts
  function renderMigrationSql(diffs: SchemaDiff[]): string;
  ```
- DDL生成例：
  - `AddColumn` → `ALTER TABLE ... ADD COLUMN ...;`
  - `AlterColumnType` → `ALTER TABLE ... ALTER COLUMN ... TYPE ...;`
  - `CreateTable` → `CREATE TABLE ...;`
- CLIコマンド案：
  - `rawsql-ts schema diff --current=prod.json --desired=local.json > migration.sql`

**アウトプット**

- DDL生成ロジック
- 簡単なCLIエントリ＋サンプル

---

## フェーズ4：診断＆「オープンな変換」機能

### 4-1. rewrite 内容を可視化する「explain-rewrite」API / CLI

**目的**  
AST変換が「何をしたか」を人間とAI両方が理解できるようにする。

**指示**

- API案：
  ```ts
  type RewriteStep = {
    name:
      | 'NormalizeInsertValuesToSelect'
      | 'InjectFixtures'
      | 'ApplyTypeCasts'
      | string;
    beforeSql: string;
    afterSql: string;
  };

  async function explainRewrite(
    sql: string,
    mode: 'select' | 'cud',
  ): Promise<RewriteStep[]>;
  ```
- CLI案：
  - `rawsql-ts explain --mode=cud 'insert into ...'`
  - 各ステップごとに Before/After SQL を表示。

**アウトプット**

- `explainRewrite` 実装
- 簡単なCLI実装
- サンプルスクリプト

---

### 4-2. 設定オプションの設計（変換ON/OFF）

**目的**  
「型CASTはやるけど runtime検証はやらない」など、ユーザが挙動を調整できるようにする。

**指示**

- 設定型案：
  ```ts
  type CudTestkitOptions = {
    enableRuntimeDtoValidation?: boolean;
    enableTypeCasts?: boolean;
    failOnShapeIssues?: boolean;
    // 将来拡張用のフラグもここに追加
  };
  ```
- `TestkitDbAdapter` や CUD パイプライン内でこのオプションを参照し、
  - 実行するステップ
  - エラーにするか警告にするか
  を切り替えられるようにする。

**アウトプット**

- オプション型
- デフォルト設定
- 利用箇所の実装

---

## フェーズ5：ドキュメント & サンプル

### 5-1. CUDテストのチュートリアルプロジェクト

**目的**  
実装された機能を、人間とAIの両方が試しやすい形にまとめる。

**指示**

- 小さな `customers` ドメインを例にしたサンプルを作る：
  - `customers` テーブルの `TableDef`
  - `CustomerRepository`（insert/update メソッド）
  - CUD テスト（DB非依存）のテストファイル
  - `schema diff → migration.sql` のサンプル
- `examples/cud-testkit/` のようなディレクトリを作り、  
  `README.md` に実行方法とコンセプト要約を書く。

**アウトプット**

- 動くサンプルプロジェクト一式
- 簡単な README

---

以上が、CUD 対応・マイグレ差分・オープンな変換可視化までを含む  
**AIエージェント向けタスクリスト** なのだ。

このファイルをコンテキストとして与えれば、エージェントは  
どの部分からでも段階的に実装を進められるはずなのだ。
