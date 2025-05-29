# rawsql-ts Infrastructure Layer DTO Pattern Demo

This demo showcases how **rawsql-ts** enables clean separation between domain and infrastructure layers using the DTO (Data Transfer Object) pattern with real PostgreSQL database operations.

## 🎯 What This Demo Demonstrates

### Clean Architecture Benefits
- **Domain Layer**: Pure business logic with `TodoSearchCriteria` and `Todo` entities
- **Infrastructure Layer**: Database-specific transformations and SQL generation
- **DTO Pattern**: Seamless conversion between domain concepts and SQL operations

### rawsql-ts Capabilities
- **Dynamic WHERE Clause Injection**: Automatically builds complex WHERE conditions
- **Type-Safe Parameter Binding**: Prevents SQL injection with proper parameter binding
- **Multiple SQL Operators**: LIKE patterns, equality checks, date ranges with `>=` and `<=`
- **Database Dialect Support**: PostgreSQL-specific formatting and quoting
- **Real Database Integration**: Actual PostgreSQL connection with connection pooling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL database)

### Setup & Run
```bash
# 1. Start PostgreSQL database
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Run the demo
npm run demo

# 4. Clean up (when done)
docker-compose down
```

## 📊 Demo Examples

The demo runs 7 different search scenarios that demonstrate the DTO pattern transformation:

### 1. **Empty Criteria** (All Records)
```typescript
// Domain Input
{}

// Infrastructure DTO
{}

// Generated SQL
WHERE 1=1 AND (title IS NOT NULL OR title IS NULL)...
// Returns all 12 todos
```

### 2. **Title Search with LIKE Pattern**
```typescript
// Domain Input
{ title: "project" }

// Infrastructure DTO  
{ title: { like: "%project%" } }

// Generated SQL
WHERE ... AND title LIKE $1
// Parameters: ["%project%"]
```

### 3. **Status Filter** (Exact Match)
```typescript
// Domain Input
{ status: "pending" }

// Infrastructure DTO
{ status: "pending" }

// Generated SQL  
WHERE ... AND status = $1
// Parameters: ["pending"]
```

### 4. **Date Range Search**
```typescript
// Domain Input
{ fromDate: "2025-05-20", toDate: "2025-05-30" }

// Infrastructure DTO
{ 
  created_at: { 
    ">=": "2025-05-20T00:00:00.000Z",
    "<=": "2025-05-30T00:00:00.000Z" 
  } 
}

// Generated SQL
WHERE ... AND created_at >= $1 AND created_at <= $2
```

### 5. **Complex Multi-Field Search**
```typescript
// Domain Input
{ 
  title: "project", 
  status: "pending", 
  priority: "high",
  fromDate: "2025-05-01" 
}

// Infrastructure DTO
{
  title: { like: "%project%" },
  status: "pending", 
  priority: "high",
  created_at: { ">=": "2025-05-01T00:00:00.000Z" }
}

// Generated SQL
WHERE ... AND title LIKE $1 AND status = $2 AND priority = $3 AND created_at >= $4
```

## 🏗️ Architecture Pattern

### Domain Layer (`src/domain.ts`)
```typescript
// Pure business entities and search criteria
export interface Todo {
  id: number;
  title: string;
- **実際のPostgreSQLデータベース**での動作確認

## 🏗️ アーキテクチャ

```
Domain Layer (ビジネスロジック)
    ↓ DTO変換
Infrastructure Layer (データベース操作)
    ↓ rawsql-ts
PostgreSQL Database (Docker)
```

## 🚀 セットアップ & 実行

### 1. PostgreSQL起動 (Docker)

```bash
docker-compose up -d
```

### 2. 依存関係インストール

```bash
npm install
```

### 3. デモ実行

```bash
npm run demo
```

## 📊 デモ内容

### ドメイン検索条件 → インフラ状態の変換例

#### 1. タイトル検索
```typescript
// Domain
{ title: "project" }

// Infrastructure (DTO)
{ title: { like: "%project%" } }

// Generated SQL
WHERE title LIKE $1  -- $1 = "%project%"
```

#### 2. 日付範囲検索
```typescript
// Domain
{ fromDate: new Date('2024-01-01'), toDate: new Date('2024-12-31') }

// Infrastructure (DTO)
{ created_at: { '>=': '2024-01-01T00:00:00.000Z', '<=': '2024-12-31T23:59:59.999Z' } }

// Generated SQL
WHERE created_at >= $1 AND created_at <= $2
```

## 🎯 rawsql-tsの利点

1. **自動WHERE句インジェクション**
   - 動的な条件追加
   - SQLインジェクション対策

2. **型安全なパラメータバインディング**
   - コンパイル時の型チェック
   - 実行時の安全性

3. **クリーンなアーキテクチャ**
   - ドメインとインフラの分離
   - 再利用可能なコンポーネント

4. **複数データベース対応**
   - PostgreSQL, MySQL, SQLite対応
   - 方言固有の最適化

## 🛠️ ファイル構成

- `src/domain.ts` - ドメイン層の型定義
- `src/infrastructure.ts` - インフラ層のDTO変換とDB操作
- `src/demo.ts` - デモ実行スクリプト
- `docker-compose.yml` - PostgreSQL環境
- `init-db.sql` - サンプルデータ

## 🔧 データベース設定

- **Host**: localhost
- **Port**: 5433
- **Database**: infrastructure_demo
- **User**: demo_user
- **Password**: demo_password

## 📈 パフォーマンス

- コネクションプール使用
- インデックス最適化済み
- 効率的なクエリ生成

## 🎉 期待される出力

```
🎯 rawsql-ts Infrastructure Layer DTO Pattern Demo (Real PostgreSQL)
================================================================

🔌 Testing database connection...
✅ Database connection successful!

📋 Example 1: Empty criteria (all records)
──────────────────────────────────────────────────
🏛️  Domain Criteria:
{}

🔧 Infrastructure State (DTO):
{
  "title": undefined,
  "status": undefined,
  "priority": undefined,
  "created_at": undefined
}

💾 Executing against PostgreSQL database...
📊 Query Results: Found 12 todos
   1. Security audit (pending, high)
   2. Implement search feature (pending, high)
   ...
```
