# AI Maintenance Guide: rawsql-ts Infrastructure Layer Demo

AI systems reference document for understanding and maintaining this rawsql-ts implementation.

## Project Overview

**Purpose**: Demonstrates rawsql-ts library with Clean Architecture, type safety, and performance comparison vs Prisma ORM.

**Core Features**:
- Clean Architecture with layer separation
- Type safety with runtime validation
- TodoTableView pattern for UI optimization
- Prisma vs rawsql-ts performance comparison
- External SQL file management

**Technology Stack**: TypeScript, PostgreSQL, rawsql-ts, Node.js 18+, Prisma (comparison only)

## Directory Structure

```
src/
├── contracts/
│   ├── search-criteria.ts          # Search criteria interfaces
│   ├── repository-interfaces.ts    # Repository contracts
│   └── sql-logger.ts              # SQL logging interface
├── domain/
│   └── entities.ts                 # Business entities (Todo, TodoTableView)
├── infrastructure/
│   ├── database-config.ts          # Database connection config
│   ├── rawsql-infrastructure.ts    # Main repository implementation
│   ├── prisma-infrastructure.ts    # Prisma comparison implementation
│   ├── schema-definitions.ts       # Schema management
│   ├── sql-loader.ts              # SQL file loader
│   └── sql/                       # External SQL files
├── demos/
│   ├── example-data.ts             # Test data
│   ├── findById-advanced-demo.ts   # Advanced query demo
│   └── prisma-vs-rawsql-ts-demo.ts # Performance comparison
└── test/
    └── repository.test.ts          # Unit tests
```

**Layer Dependencies**:
- Domain: No dependencies
- Contracts: Domain only
- Infrastructure: Domain + Contracts
- Demos: All layers
## Key Implementation Patterns

### 1. Type Safety with Runtime Validation

```typescript
interface TodoTableViewRow {
    todo_id: number;
    title: string;
    description: string | null;
    status: TodoStatus;
    // ... other fields
}

function isTodoTableViewRow(row: any): row is TodoTableViewRow {
    return typeof row.todo_id === 'number' && 
           typeof row.title === 'string' &&
           // ... validation logic
}
```

**Benefits**: Compile-time + runtime safety, early error detection

### 2. TodoTableView Pattern

```typescript
export interface TodoTableView {
    todo_id: number;
    title: string;
    status: TodoStatus;
    category_name?: string;  // Flattened from JOIN
    // ... optimized for UI display
}
```

**Benefits**: Single query with JOIN, direct UI mapping, eliminates N+1 queries

### 3. Shared Instance Optimization

```typescript
export class RawSQLTodoRepository {
    private readonly sqlParamInjector: SqlParamInjector;
    private readonly sqlFormatter: SqlFormatter;
    
    constructor(enableDebugLogging: boolean = false) {
        // Initialize once, reuse for all methods
        this.sqlParamInjector = new SqlParamInjector(getTableColumns);
        this.sqlFormatter = new SqlFormatter({ preset: 'postgres' });
    }
}
```

**Benefits**: Reduced object creation overhead, improved performance
- **Memory Efficiency**: Minimizes garbage collection pressure
- **Consistency**: Ensures same configuration across all operations
- **Initialization Cost**: One-time setup cost instead of repeated instantiation

### 4. **Performance Comparison Framework**
Implementation of comprehensive ORM comparison system:

```typescript
// Performance measurement integration
async findByCriteria(criteria: TodoSearchCriteria): Promise<TodoTableView[]> {
    const startTime = performance.now();
    // rawsql-ts implementation with single JOIN query
    const result = await this.executeOptimizedQuery(criteria);
    const endTime = performance.now();
    
    this.debugLog(`✅ Query completed in ${(endTime - startTime).toFixed(2)}ms`);
    return result;
}
```

**Comparison Benefits:**
- **Query Count Analysis**: rawsql-ts (1 query) vs Prisma (2+ queries)
- **Performance Metrics**: Execution time measurement and logging
- **Memory Usage**: Object creation and mapping efficiency
- **SQL Optimization**: JOIN optimization vs N+1 query patterns

### 5. **External SQL File Management**
Separation of SQL queries into dedicated files for maintainability:

```typescript
// sql-loader.ts - SQL file management utility
export class SqlLoader {
    private queryCache: Map<string, string> = new Map();
    
    loadAllQueries(): void {
        this.queryCache.set('findTodos', this.loadSqlFile('find-todos.sql'));
        this.queryCache.set('countTodos', this.loadSqlFile('count-todos.sql'));
        // ... other queries
    }
}
```

**Maintenance Advantages:**
- **SQL Readability**: Complex queries in dedicated SQL files
- **Version Control**: Better diff tracking for SQL changes
- **Database Optimization**: Direct SQL editing without TypeScript recompilation
- **Team Collaboration**: Database specialists can optimize queries independently

## 🔧 Core Classes & Components

### 1. RawSQLTodoRepository (`src/infrastructure/rawsql-infrastructure.ts`)

**Purpose**: Type-safe database access implementation for Todo entities with performance optimization

**Key Methods**:
```typescript
// Enhanced search with TodoTableView return type for UI optimization
async findByCriteria(criteria: TodoSearchCriteria): Promise<TodoTableView[]>

// Count matching todos with same search criteria
async countByCriteria(criteria: TodoSearchCriteria): Promise<number>

// Detailed data retrieval with relations (single query via PostgresJsonQueryBuilder)
async findById(id: string): Promise<TodoDetail | null>

// Domain criteria to SQL state conversion with type safety
convertToSearchState(criteria: TodoSearchCriteria): Record<string, any>

// Type-safe mapping with runtime validation
private mapRowToTodoTableView(row: any): TodoTableView
```

**Type Safety Features**:
- **Runtime Type Guards**: `isTodoTableViewRow()` for database row validation
- **Compile-time Types**: Strong TypeScript interfaces for all data structures
- **Error Handling**: Comprehensive error messages with data structure validation
- **Null Safety**: Proper handling of null/undefined database values

**Performance Optimizations**:
- **Shared Instances**: `SqlParamInjector`, `SqlFormatter`, `PostgresJsonQueryBuilder`
- **Query Caching**: SQL queries loaded once and cached in memory
- **Connection Pooling**: PostgreSQL connection pool management
- **Debug Logging**: Configurable performance monitoring and query logging

### 2. PrismaInfrastructure (`src/infrastructure/prisma-infrastructure.ts`)

**Purpose**: Prisma ORM implementation for performance comparison and alternative approach demonstration

**Key Features**:
- **Prisma Client Integration**: Type-safe ORM queries with generated types
- **Batch Fetching**: Optimized relation loading with Prisma's built-in strategies
- **Query Optimization**: Select-based queries instead of include for better performance
- **TodoTableView Mapping**: Conversion from Prisma entities to flattened table view

### 3. Schema Definition System (`src/infrastructure/schema-definitions.ts`)

**Purpose**: Unified schema management eliminating code duplication

**Provided Functions**:
```typescript
## rawsql-ts Library Components

**SqlParamInjector**: Type-safe parameter binding, dynamic WHERE clauses
**SqlFormatter**: SQL formatting, PostgreSQL dialect
**PostgresJsonQueryBuilder**: Single query for hierarchical JSON data

### Performance: rawsql-ts vs Prisma

**TodoTableView queries**:
- rawsql-ts: Single JOIN query
- Prisma: Multiple queries + manual mapping

**TodoDetail queries**:
- rawsql-ts: 1 CTE query with JSON aggregation  
- Prisma: 3 separate queries

## Maintenance Procedures

### Adding Search Criteria

1. Update `TodoSearchCriteria` interface in domain/entities.ts
2. Add column in schema-definitions.ts
3. Add conversion logic in rawsql-infrastructure.ts convertToSearchState()
4. Update Prisma implementation for comparison

### Adding Repository Methods

1. Add to ITodoRepository interface
2. Implement in rawsql-infrastructure.ts using shared instances
3. Implement Prisma equivalent for comparison
4. Add to demo files for testing

### Type Safety Enhancement

```typescript
// Always add runtime validation
interface DatabaseRow { /* define structure */ }
function isValidRow(row: any): row is DatabaseRow { /* validate */ }

// Use in mapping
private mapRow(row: any): Entity {
    if (!isValidRow(row)) {
        throw new Error(`Invalid row: ${JSON.stringify(row)}`);
    }
    return { /* safe mapping */ };
}
```

## Critical Files

**rawsql-infrastructure.ts**: Main repository, type safety, performance optimizations
**entities.ts**: Domain entities, TodoTableView pattern
**schema-definitions.ts**: Single source of truth for schema
**prisma-infrastructure.ts**: Comparison implementation
**sql/ directory**: External optimized SQL queries

## Error Patterns

- Use shared instances in constructor (sqlParamInjector, sqlFormatter, postgresJsonQueryBuilder)
- Always validate database rows with type guards
- Include performance logging for operations
- Handle null/undefined mapping (database null → TypeScript undefined)
- Import hierarchy: rawsql-ts → contracts → domain → infrastructure
