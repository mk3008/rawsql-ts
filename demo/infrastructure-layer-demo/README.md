# rawsql-ts Infrastructure Layer & Unified Schema Demo

This demo showcases how **rawsql-ts** enables clean separation between domain and infrastructure layers using the DTO (Data Transfer Object) pattern with real PostgreSQL database operations. Additionally, it demonstrates the **Unified Schema System** that eliminates code duplication and provides automatic configuration generation.

## 🎯 What This Demo Demonstrates

### Clean Architecture Benefits
- **Domain Layer**: Pure business logic with `TodoSearchCriteria` and `Todo` entities
- **Infrastructure Layer**: Database-specific transformations and SQL generation
- **DTO Pattern**: Seamless conversion between domain concepts and SQL operations
- **Unified Schema**: Single source of truth for all database table definitions

### rawsql-ts Capabilities
- **Dynamic WHERE Clause Injection**: Automatically builds complex WHERE conditions
- **Type-Safe Parameter Binding**: Prevents SQL injection with proper parameter binding
- **Hierarchical JSON Queries**: PostgresJsonQueryBuilder for complex data structures
- **Schema Management**: Unified schema definitions with automatic code generation
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

# 3. Run different demos
npm run demo                    # Main DTO pattern demo
npm run findById-demo          # Enhanced findById with JSON hierarchies
npm run unified-schema-demo    # Schema unification features
npm run migrated-schema-demo   # Library-based schema management

# 4. Clean up (when done)
docker-compose down
```

## 📊 Available Demos

### 1. **Main Demo** (`npm run demo`)
The core DTO pattern demonstration with 10 different search scenarios showing domain-to-infrastructure transformations.

### 2. **FindById Demo** (`npm run findById-demo`)
Enhanced findById functionality demonstrating:
- **PostgresJsonQueryBuilder**: Single query returning hierarchical JSON
- **Related Data**: Todo + Category + Comments in one query
- **Type Safety**: TodoDetail interface with nested structures

### 3. **Unified Schema Demo** (`npm run unified-schema-demo`)
Schema unification features showing:
- **Single Source of Truth**: Centralized table definitions
- **Automatic Generation**: SqlParamInjector columns & PostgresJsonQueryBuilder mappings
- **Zod Validation**: Built-in schema validation
- **Code Deduplication**: Eliminates redundant schema information

### 4. **Migrated Schema Demo** (`npm run migrated-schema-demo`)
Library-based schema management demonstrating:
- **rawsql-ts SchemaManager**: Library-provided schema utilities
- **Type Safety**: Enhanced TypeScript integration
- **Consistency**: Standardized schema API across projects

## 📋 Main Demo Examples

### 1. **Empty Criteria** (All Records)
```typescript
// Domain Input
{}

// Infrastructure DTO
{}

// Generated SQL
SELECT * FROM todo ORDER BY priority, created_at DESC
// Returns all 12 todos
```

### 2. **Title Search with LIKE Pattern**
```typescript
// Domain Input
{ title: "project" }

// Infrastructure DTO  
{ title: { like: "%project%" } }

// Generated SQL
WHERE title LIKE $1
// Parameters: ["%project%"]
```

### 3. **Complex Multi-Field Search**
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
WHERE title LIKE $1 AND status = $2 AND priority = $3 AND created_at >= $4
```

## 🎨 Unified Schema System

### Problem Solved
Before the unified schema, we had code duplication:
- `database-config.ts`: Column definitions for SqlParamInjector
- `rawsql-infrastructure.ts`: Mapping definitions for PostgresJsonQueryBuilder

### Solution
Single schema definition in `schema-migrated.ts`:
```typescript
export const todoTableDef: TableDefinition = {
    name: 'todo',
    columns: {
        todo_id: { name: 'todo_id', type: 'number', isPrimaryKey: true },
        title: { name: 'title', type: 'string', required: true },
        // ... more columns
    },
    relationships: [
        { type: 'belongsTo', table: 'category', foreignKey: 'category_id' },
        { type: 'hasMany', table: 'todo_comment', foreignKey: 'todo_id' }
    ]
};
```

### Automatic Generation
```typescript
// Automatically generates SqlParamInjector columns
const columns = schemaManager.getTableColumns('todo');

// Automatically generates PostgresJsonQueryBuilder mapping
const mapping = schemaManager.createJsonMapping('todo');

// Bonus: Zod schemas for validation
const zodSchema = schemaManager.createZodSchema('todo');
```

## 🏗️ Architecture Pattern

### Before (Code Duplication)
```
database-config.ts     ←── Duplicate schema info
rawsql-infrastructure.ts ←── Duplicate schema info
```

### After (Unified Schema)
```
schema-migrated.ts (rawsql-ts SchemaManager)
    ↓ Auto-generates
├── SqlParamInjector columns
├── PostgresJsonQueryBuilder mappings
└── Zod validation schemas
```

### Domain Layer (`src/domain.ts`)
```typescript
// Pure business entities and search criteria
export interface Todo {
  todo_id: number;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  category_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TodoSearchCriteria {
  title?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  categoryId?: number;
  categoryName?: string;
  fromDate?: Date;
  toDate?: Date;
}
```

### Infrastructure Layer (`src/rawsql-infrastructure.ts`)
```typescript
// Handles DTO conversion and database operations
export class RawSQLTodoRepository implements ITodoRepository {
  // Converts domain criteria to database state
  convertToSearchState(criteria: TodoSearchCriteria): Record<string, any>

  // Performs database queries with rawsql-ts
  async findByCriteria(criteria: TodoSearchCriteria): Promise<Todo[]>
  async findById(id: string): Promise<TodoDetail | null>
}
```

### Schema Management (`src/schema-migrated.ts`)
```typescript
// Unified schema definitions using rawsql-ts SchemaManager
import { SchemaManager, TableDefinition } from 'rawsql-ts';

export const schemaManager = new SchemaManager({
  todo: todoTableDef,
  category: categoryTableDef,
  todo_comment: todoCommentTableDef
});

// Auto-generated utilities
export const getTableColumns = (table: string) => schemaManager.getTableColumns(table);
export const createJsonMapping = (table: string) => schemaManager.createJsonMapping(table);
```

## 🛠️ File Structure

```
src/
├── domain.ts                    # Pure business logic & types
├── infrastructure-interface.ts  # Repository contracts
├── rawsql-infrastructure.ts     # Database implementation
├── database-config.ts          # DB connection & column resolver
├── schema-migrated.ts          # Unified schema (rawsql-ts library)
├── demo.ts                     # Main DTO pattern demo
├── findById-demo.ts           # Enhanced findById demo
├── unified-schema-demo.ts     # Schema unification demo
└── migrated-schema-demo.ts    # Library migration demo

docker-compose.yml              # PostgreSQL environment
init-db.sql                    # Sample data setup
```

## 🎯 Key Benefits

### 1. **Code Deduplication**
- **Before**: ~65 lines of duplicate schema information
- **After**: Single source of truth with automatic generation

### 2. **Type Safety**
- TypeScript interfaces for domain objects
- Zod schemas for runtime validation
- rawsql-ts library types for schema management

### 3. **Clean Architecture**
- Domain layer remains pure and testable
- Infrastructure layer handles all database concerns
- DTO pattern enables clean transformations

### 4. **Developer Experience**
- IntelliSense support with library types
- Automatic error detection
- Consistent API across projects

### 5. **Performance**
- Connection pooling with PostgreSQL
- Optimized query generation
- Single queries for hierarchical data

## 📈 Migration Benefits

### From Local to Library-Based Schema
1. **Standardization**: Using rawsql-ts SchemaManager
2. **Future-Proofing**: Automatic library updates
3. **Consistency**: Same API across all rawsql-ts projects
4. **Type Safety**: Enhanced TypeScript integration
5. **Maintainability**: Reduced local code complexity

## 🔧 Configuration

### Database Settings
- **Host**: localhost
- **Port**: 5433  
- **Database**: infrastructure_demo
- **User**: demo_user
- **Password**: demo_password

### Debug Logging
```typescript
// Enable debug logging for detailed SQL output
const repo = new RawSQLTodoRepository(true);

// Disable debug logging
repo.setDebugLogging(false);
```
## 🎉 Expected Output Examples

### Main Demo Output
```
🎯 rawsql-ts Infrastructure Layer DTO Pattern Demo (Real PostgreSQL)
================================================================

🔌 Testing database connection...
✅ Database connection successful!

� Example 1: Empty criteria (all records)
──────────────────────────────────────────────────
🏛️  Domain Criteria:
{}

🔧 Infrastructure State (DTO):
{}

🔍 Generated SQL:
   select "todo_id", "title", "description", "status", "priority", "category_id", "created_at", "updated_at" 
   from "todo" 
   order by case "priority" when 'high' then 1 when 'medium' then 2 when 'low' then 3 end, "created_at" desc

💾 Executing against PostgreSQL database...
📊 Query Results: Found 12 todos
   1. Security audit (pending, high)
   2. Implement search feature (pending, high)
   3. Complete project documentation (pending, high)
   ... and 9 more
```

### FindById Demo Output
```
🎯 rawsql-ts Enhanced findById Demo
==========================================

📋 Test Case 1: Find Todo with Related Data
──────────────────────────────────────────────────
🔍 Searching for todo ID: 1

✅ Todo found!
📊 TodoDetail Structure:
{
  "title": "Complete project documentation",
  "status": "pending",
  "todo_id": 1,
  "category": {
    "name": "Work",
    "color": "#3498db",
    "category_id": 1,
    "description": "Work-related tasks and projects"
  },
  "comments": [
    {
      "content": "Started working on the API documentation section",
      "author_name": "Alice Johnson",
      "todo_comment_id": 1
    }
  ]
}
```

### Unified Schema Demo Output
```
🎯 Unified Schema Demo
======================

� Automatic Column List Generation:
──────────────────────────────────────
todo: ['todo_id', 'title', 'description', 'status', 'priority', 'category_id', 'created_at', 'updated_at']
category: ['category_id', 'name', 'description', 'color', 'created_at']

🎨 Automatic JSON Mapping Generation:
─────────────────────────────────────
Root entity: todo
Nested entities: ['category (object)', 'todo_comment (array)']

✅ Zod Validation Examples:
──────────────────────────
✅ Validation passed for valid todo
❌ Validation correctly failed - missing required field
```

## � Next Steps

1. **Extend Schema**: Add more tables to the unified schema
2. **Custom Validation**: Create domain-specific Zod schemas
3. **API Integration**: Use schemas for REST API validation
4. **Form Generation**: Auto-generate forms from schemas
5. **Migration Scripts**: Generate database migration scripts

## 🤝 Contributing

This demo is part of the rawsql-ts project. Feel free to:
- Suggest improvements to the schema system
- Add new demo scenarios
- Report issues or bugs
- Contribute to the rawsql-ts library

## 📚 Related Documentation

- [rawsql-ts Library Documentation](../../docs/)
- [SchemaManager Usage Guide](../../docs/usage-guides/class-SchemaManager-usage-guide.md)
- [PostgresJsonQueryBuilder Guide](../../docs/usage-guides/class-PostgresJsonQueryBuilder-usage-guide.md)
- [SqlParamInjector Guide](../../docs/usage-guides/class-SqlParamInjector-usage-guide.md)
