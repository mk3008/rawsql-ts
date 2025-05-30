# AI Maintenance Guide for rawsql-ts Infrastructure Layer Demo

このドキュメントは、AI（人工知能）がこのrawsql-ts Infrastructure Layer Demoプロジェクトを理解し、適切にメンテナンスするためのガイドです。

## 📋 プロジェクト概要

このプロジェクトは **Clean Architecture** の原則に基づいて設計された **rawsql-ts** ライブラリのデモンストレーションです。型安全でメンテナブルなSQL クエリシステムの構築方法を実演しています。

### 核心的な目的
- **Clean Architecture** の原則に基づいた明確な層分離の実演
- **rawsql-ts** ライブラリの動的SQL生成機能のショーケース
- 現実世界での **DTO パターン** 実装例の提供
- **統合スキーマシステム** の利点を実証

### 技術スタック
- **Language**: TypeScript
- **Database**: PostgreSQL (Docker Compose)
- **Library**: rawsql-ts (SqlParamInjector, SqlFormatter, PostgresJsonQueryBuilder)
- **Runtime**: Node.js 18+
- **Package Manager**: npm
- **Architecture**: Clean Architecture with Repository Pattern

## 🏗️ ディレクトリ構造 (Clean Architecture)

```
src/
├── contracts/                      # 📋 契約・インターフェース層
│   ├── search-criteria.ts          # 検索条件のインターフェース定義
│   └── repository-interfaces.ts    # リポジトリのインターフェース定義
├── domain/                         # 🎯 純粋なドメイン層
│   └── entities.ts                 # ビジネスエンティティ（Todo, Category, etc.）
├── infrastructure/                 # 🏗️ インフラ実装層
│   ├── database-config.ts          # データベース接続設定
│   ├── rawsql-infrastructure.ts    # Repository実装クラス
│   └── schema-migrated.ts          # 統合スキーマ管理
└── demos/                          # 🎪 デモ・テスト層
    ├── example-data.ts              # テスト用のサンプルデータ
    ├── findById-advanced-demo.ts    # 高度なクエリのデモ
    ├── migrated-schema-demo.ts      # スキーママイグレーションのデモ
    ├── run-all-demos.ts            # 統合デモ実行ツール
    └── schema-features-demo.ts      # スキーマ機能のデモ
```

### 層の責任分離

#### 1. Domain Layer (`src/domain/entities.ts`)
**責任**: 純粋なビジネスロジックとエンティティ定義
**依存関係**: なし（他の層に依存しない）
**内容**:
- `Todo`, `Category`, `TodoComment` エンティティ
- `TodoStatus`, `TodoPriority` 型定義
- `TodoDetail`, `TodoWithCategory` 拡張インターフェース

#### 2. Contracts Layer (`src/contracts/`)
**責任**: レイヤー間の契約定義
**依存関係**: Domain Layer のみ
**内容**:
- `search-criteria.ts`: 検索条件のインターフェース
- `repository-interfaces.ts`: リポジトリの契約

#### 3. Infrastructure Layer (`src/infrastructure/`)
**責任**: 技術的実装とデータベースアクセス
**依存関係**: Domain, Contracts Layers
**内容**:
- `rawsql-infrastructure.ts`: メインのRepository実装
- `database-config.ts`: DB接続とプール管理
- `schema-migrated.ts`: 統合スキーマ定義

#### 4. Demos Layer (`src/demos/`)
**責任**: デモンストレーションとテスト
**依存関係**: すべての層
**内容**: 各種デモファイルとサンプルデータ

## 🏗️ アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLEAN ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│  demos/                        ← アプリケーション層              │
│  ├── findById-advanced-demo.ts    複雑なクエリデモ               │
│  ├── migrated-schema-demo.ts      スキーママイグレーション        │
│  ├── schema-features-demo.ts      メインデモ                    │
│  └── run-all-demos.ts            統合デモランナー               │
├─────────────────────────────────────────────────────────────────┤
│  contracts/                    ← 契約層                         │
│  ├── repository-interfaces.ts    リポジトリ契約                  │
│  └── search-criteria.ts          検索条件DTO                    │
├─────────────────────────────────────────────────────────────────┤
│  domain/                       ← 純粋ドメイン層                 │
│  └── entities.ts                 ビジネスエンティティ             │
├─────────────────────────────────────────────────────────────────┤
│  infrastructure/               ← インフラストラクチャ層           │
│  ├── rawsql-infrastructure.ts    リポジトリ実装                  │
│  ├── database-config.ts          DB設定                         │
│  └── schema-migrated.ts          統合スキーマ定義                │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 重要なアーキテクチャ決定

### 1. **共有インスタンス最適化**
`RawSQLTodoRepository` クラスはパフォーマンス最適化のため共有インスタンスを使用：

```typescript
export class RawSQLTodoRepository implements TodoRepository {
    // 最適化：メソッド毎に新しいインスタンスを作成せず共有インスタンスを使用
    private readonly paramInjector: SqlParamInjector;
    private readonly formatter: SqlFormatter;
    private readonly jsonBuilder: PostgresJsonQueryBuilder;

    constructor(private readonly pool: Pool) {
        // コンストラクタで一度だけ共有インスタンスを初期化
        this.paramInjector = new SqlParamInjector(columnsConfig);
        this.formatter = new SqlFormatter('postgres');
        this.jsonBuilder = new PostgresJsonQueryBuilder();
    }
}
```

**重要な理由:**
- **パフォーマンス**: 各メソッド呼び出しで複数インスタンス作成を回避
- **メモリ効率**: オブジェクト生成のオーバーヘッドを削減
- **一貫性**: 全操作で同じ設定を保証

### 2. **統合スキーマシステム**
単一のスキーマ定義からすべての設定を自動生成：

```typescript
// schema-migrated.ts - 中央集約スキーマ定義
export const todoTableDef: TableDefinition = {
    name: 'todo',
    columns: {
        todo_id: { name: 'todo_id', type: 'number', isPrimaryKey: true },
        title: { name: 'title', type: 'string', required: true },
        // ... 完全なカラム定義
    },
    relationships: [
        { type: 'belongsTo', table: 'category', foreignKey: 'category_id' },
        { type: 'hasMany', table: 'todo_comment', foreignKey: 'todo_id' }
    ]
};
```

**利点:**
- **コード重複なし**: 単一スキーマ定義からすべての設定を生成
- **型安全性**: 自動TypeScript型生成
- **一貫性**: SqlParamInjectorとPostgresJsonQueryBuilderで同じスキーマ使用
- **保守性**: スキーマ変更が自動的に伝播

### 3. **Clean Architecture層分離**

#### Domain Layer (`domain/entities.ts`)
- **純粋なビジネスエンティティ** - 外部依存関係なし
- **コアビジネスルール** とバリデーションロジック
- **技術非依存** - 任意のデータベースやフレームワークで使用可能

#### Contracts Layer (`contracts/`)
- **リポジトリパターンのインターフェース定義**
- **ドメイン-インフラ間のクリーンな通信のための検索条件DTO**
- **依存関係逆転** - ドメインは抽象に依存、実装には依存しない

#### Infrastructure Layer (`infrastructure/`)
- **リポジトリインターフェースの具象実装**
- **データベース固有ロジック** とSQL生成
- **外部システム統合** (PostgreSQL、コネクションプーリング)

## 🔧 核心クラス・コンポーネント

### 1. RawSQLTodoRepository (`src/infrastructure/rawsql-infrastructure.ts`)

**目的**: Todoエンティティのデータベースアクセス実装

**主要メソッド**:
```typescript
// 検索条件に基づくTodo検索
async findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]>

// 検索条件に一致するTodo数の取得
async countByCriteria(criteria: TodoSearchCriteria): Promise<number>

// IDによる詳細データ取得（関連データ含む）
async findById(id: string): Promise<TodoDetail | null>

// ドメイン条件からSQL状態への変換
convertToSearchState(criteria: TodoSearchCriteria): Record<string, any>
```

**最適化のポイント**:
- 共有インスタンス: `SqlParamInjector`, `SqlFormatter`, `PostgresJsonQueryBuilder`
- デバッグログ機能: `setDebugLogging(boolean)`
- コネクションプール: PostgreSQL Pool

### 2. SchemaManager Integration (`src/infrastructure/schema-migrated.ts`)

**目的**: 統合スキーマ管理によるコード重複の排除

**提供機能**:
```typescript
// テーブルカラム定義の自動生成
export const getTableColumns = (table: string) => schemaManager.getTableColumns(table);

// JSONマッピングの自動生成
export const createJsonMapping = (table: string) => schemaManager.createJsonMapping(table);

// Zodスキーマの自動生成
export const createZodSchema = (table: string) => schemaManager.createZodSchema(table);
```

## 🎯 メンテナンス時の重要なポイント

### 1. エラーハンドリングパターン

**データベースエラー**:
```typescript
try {
    const result = await this.pool.query(formattedSql, params as any[]);
    // 処理
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.debugLog('❌ Operation error:', error);
    throw new Error(`Failed to operation: ${errorMessage}`);
}
```

### 2. インポート文のパターン

**正しいインポート構造**:
```typescript
// 外部ライブラリ (rawsql-ts)
import { SqlParamInjector, SqlFormatter, PostgresJsonQueryBuilder } from '../../../..';

// Contracts層
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { ITodoRepository } from '../contracts/repository-interfaces';

// Domain層
import { Todo, TodoDetail } from '../domain/entities';

// 同じInfrastructure層内
import { getTableColumns, DATABASE_CONFIG } from './database-config';
```

### 3. 型安全性の確保

**重要な型定義**:
- すべてのエンティティに適切なTypeScript型
- `any`型の使用を最小限に
- Zodスキーマによるランタイム検証

### 4. デバッグ機能

**デバッグログの活用**:
```typescript
// デバッグログの制御
const repo = new RawSQLTodoRepository(true);  // 有効化
repo.setDebugLogging(false);  // 無効化

// デバッグ情報の出力
this.debugLog('🔍 Query execution', { sql: formattedSql, params });
```

## 🚀 rawsql-ts ライブラリ統合

### 使用している主要コンポーネント

#### 1. **SqlParamInjector**
- **目的**: 型安全なパラメータバインディングを使った動的WHERE句生成
- **使用方法**: 検索条件オブジェクトをSQL WHERE条件に変換
- **設定**: database-config.tsの`columnsConfig`を使用

#### 2. **SqlFormatter** 
- **目的**: SQL整形と方言固有の最適化
- **方言**: PostgreSQL (`'postgres'`) 用に設定
- **機能**: 自動識別子クォート、キーワード整形

#### 3. **PostgresJsonQueryBuilder**
- **目的**: 複雑なデータ関係の階層JSON クエリ生成
- **利点**: N+1クエリではなく、単一クエリでネストしたデータ構造を返す
- **使用場面**: 関連データを含むfindById操作 (Todo + Category + Comments)

## 📁 ファイル構成ガイド

### 監視すべき重要ファイル

#### `infrastructure/rawsql-infrastructure.ts` - リポジトリ実装
- **核心ロジック**: すべてのデータベース操作とDTO変換
- **パフォーマンス重要**: 最適化された共有インスタンスを含む
- **一般的な問題**: インポートパス変更、メソッドシグネチャ更新

#### `contracts/repository-interfaces.ts` - インターフェース契約
- **依存関係契約**: リポジトリメソッドシグネチャを定義
- **破壊的変更**: メソッドシグネチャ変更がすべての実装に影響
- **型安全性**: 全層にわたって一貫した契約を保証

#### `domain/entities.ts` - ドメインエンティティ
- **ビジネスルール**: コアエンティティ定義と型
- **純粋ドメイン**: 外部依存関係禁止
- **スキーマ変更**: データベーススキーマと同期を保つ必要

#### `infrastructure/schema-migrated.ts` - 統合スキーマ
- **唯一の信頼できるソース**: すべてのスキーマ定義
- **自動生成**: SqlParamInjectorとPostgresJsonQueryBuilder設定を駆動
- **一貫性のために重要**: スキーマ変更はここで最初に行う必要

### デモファイル構造

#### `demos/schema-features-demo.ts` - メインデモ
- **10の検索シナリオ**: 包括的なDTOパターン例
- **実際のデータベース操作**: 実際のPostgreSQLクエリ
- **パフォーマンステスト**: クエリ実行時間を表示

#### `demos/findById-advanced-demo.ts` - 高度な機能
- **階層JSON**: PostgresJsonQueryBuilderのデモンストレーション
- **関連データ**: Todo + Category + Commentsの単一クエリ
- **型安全性**: ネストした構造を持つTodoDetailインターフェース

#### `demos/migrated-schema-demo.ts` - スキーママイグレーション
- **ライブラリ統合**: rawsql-ts SchemaManagerの使用
- **コード生成**: スキーマからの自動設定生成
- **バリデーション**: Zodスキーマ統合例

## 🔍 一般的なメンテナンスタスク

### 新しい検索条件の追加

1. **ドメイン層の更新**:
```typescript
// domain/entities.ts - TodoSearchCriteriaインターフェースに追加
export interface TodoSearchCriteria {
    // ... 既存フィールド
    newCriteria?: string;  // 新しい検索フィールドを追加
}
```

2. **契約層の更新**:
```typescript
// contracts/search-criteria.ts - DTO変換ルールを追加
export interface TodoSearchDTO {
    // ... 既存フィールド
    newCriteria?: ColumnValue | ColumnOperators<string>;
}
```

3. **インフラストラクチャ層の更新**:
```typescript
// infrastructure/rawsql-infrastructure.ts - 変換ロジックを追加
private convertToDTO(criteria: TodoSearchCriteria): TodoSearchDTO {
    return {
        // ... 既存の変換
        ...(criteria.newCriteria && { 
            newCriteria: { like: `%${criteria.newCriteria}%` } 
        }),
    };
}
```

4. **スキーマ定義の更新**:
```typescript
// infrastructure/schema-migrated.ts - カラム定義を追加
export const todoTableDef: TableDefinition = {
    columns: {
        // ... 既存カラム
        new_criteria: { name: 'new_criteria', type: 'string' },
    }
};
```

### 新しいリポジトリメソッドの追加

1. **インターフェース契約の更新**:
```typescript
// contracts/repository-interfaces.ts
export interface TodoRepository {
    // ... 既存メソッド
    newMethod(param: ParamType): Promise<ReturnType>;
}
```

2. **インフラストラクチャでの実装**:
```typescript
// infrastructure/rawsql-infrastructure.ts
async newMethod(param: ParamType): Promise<ReturnType> {
    // 共有インスタンスを使用 (this.paramInjector, this.formatter, this.jsonBuilder)
    const query = this.paramInjector.generateQuery(/* ... */);
    const formattedSql = this.formatter.format(query.query);
    // ... 実装
}
```

3. **デモでの使用例追加**:
```typescript
// demos/ - デモファイルを作成または更新して新しいメソッドをショーケース
const result = await repository.newMethod(exampleParam);
console.log('新しいメソッド結果:', result);
```
