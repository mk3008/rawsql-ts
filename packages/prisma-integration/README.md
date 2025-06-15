# @rawsql-ts/prisma-integration

![npm version](https://img.shields.io/npm/v/@rawsql-ts/prisma-integration)
![npm downloads](https://img.shields.io/npm/dm/@rawsql-ts/prisma-integration)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## 🎯 Overview

**Transform SQL files into structured JSON with static validation - no additional schema definitions required.**

RawSqlClient is a wrapper around PrismaClient that provides three core capabilities:

1. **Structured JSON Response**: Place a JSON mapping file alongside your SQL file, and get hierarchical JSON instead of flat database rows
2. **Static SQL Validation**: Automatically validate that your SQL queries are compatible with your Prisma schema at development time
3. **Static Model Validation**: Ensure your JSON mappings match your TypeScript domain models through static analysis

### What You Can Achieve

Complex SQL queries can be paired with JSON mapping files to produce properly structured TypeScript objects with minimal configuration.

```typescript
// 🎯 Single object: Use queryOne<T>() 
const todoDetail = await rawSqlClient.queryOne<TodoDetail>('getTodoDetail.sql', {
    filter: { todo_id: 1 }
}); // → TodoDetail | null

// 🎯 Array of objects: Use queryMany<T>()
const todoList = await rawSqlClient.queryMany<TodoDetail>('getTodoList.sql', {
    filter: { completed: false }
}); // → TodoDetail[]
```

**The result structure is always the same beautiful nested object:**
```typescript
// Both queryOne and queryMany return the same object structure
{
    todoId: 1,
    title: "Learn rawsql-ts",
    description: "Master the art of structured SQL",
    completed: false,
    user: { userId: 1, userName: "Alice", email: "alice@example.com" },
    category: { categoryId: 2, categoryName: "Learning", color: "#blue" },
    comments: [
        { 
            commentId: 1, 
            commentText: "Great library!", 
            user: { userName: "Bob", email: "bob@example.com" }
        }
    ]
}
```

**Crystal clear intent. Same mapping. Perfect flexibility.** ✨

### 🔧 Behind the Magic

## 🎯 Architecture Overview

RawSqlClient leverages a two-tier approach to transform flat SQL result sets into structured hierarchical objects. This methodology combines the expressiveness of raw SQL with automated data transformation capabilities.

### Implementation Pattern

The system operates through a coordinated pair of files:

**SQL Query Definition** (`getTodoDetail.sql`):
```sql
SELECT 
    -- Primary entity attributes
    t.todo_id, t.title, t.description, t.completed,
    -- Related user entity  
    u.user_id, u.user_name, u.email,
    -- Related category entity
    c.category_id, c.category_name, c.color,
    -- Associated comments (denormalized via JOINs)
    tc.comment_id, tc.comment_text,
    cu.user_name as comment_user_name
FROM todo t
INNER JOIN "user" u ON t.user_id = u.user_id  
INNER JOIN category c ON t.category_id = c.category_id
LEFT JOIN todo_comment tc ON t.todo_id = tc.todo_id
LEFT JOIN "user" cu ON tc.user_id = cu.user_id
-- Dynamic WHERE clause injection: WHERE t.todo_id = $1
```

**Transformation Schema** (`getTodoDetail.json`):
```json
{
  "rootEntity": { 
    "columns": { "todoId": "todo_id", "title": "title", "description": "description" } 
  },
  "nestedEntities": [
    { 
      "parentId": "todo", 
      "propertyName": "user", 
      "relationshipType": "object",
      "columns": { "userId": "user_id", "userName": "user_name", "email": "email" }
    },
    { 
      "parentId": "todo", 
      "propertyName": "comments", 
      "relationshipType": "array",
      "columns": { 
        "commentId": "comment_id", 
        "commentText": "comment_text",
        "userName": "comment_user_name"
      }
    }
  ]
}
```

### Technical Implementation

The transformation engine processes denormalized SQL result sets through PostgreSQL's native JSON aggregation functions, converting flat tabular data into structured hierarchical objects. This approach eliminates N+1 query patterns while maintaining type safety and performance optimization.

### Architectural Advantages

**Schema Reuse**: RawSqlClient integrates directly with existing Prisma schema definitions, eliminating duplicate schema maintenance overhead.

**Incremental Integration**: As a PrismaClient wrapper, RawSqlClient enables selective adoption - existing Prisma code remains unchanged while specific use cases benefit from enhanced SQL capabilities.

## 🔥 Key Features

> [!Important]
> This package is designed for **PostgreSQL databases only**. The hierarchical JSON serialization feature leverages PostgreSQL-specific JSON functions and capabilities.

### Primary Capabilities

**SQL File + JSON Mapping = Structured Response**
- Place a `.json` mapping file alongside your `.sql` file
- Get hierarchical JSON structures instead of flat database rows
- No complex SQL joins or subqueries required

**Static SQL Schema Validation**
- Validate SQL queries against your Prisma schema at development time
- Catch missing tables, invalid columns, and type mismatches before deployment
- Automated regression testing through unit tests

**Static JSON Mapping Validation**
- Validate JSON mappings against your TypeScript domain models
- Ensure response structure matches expected interfaces
- Comprehensive error reporting with actionable messages

**Zero Schema Management Overhead**
- No separate DB schema definitions required - uses your existing Prisma schema
- PrismaClient wrapper - seamlessly integrates with existing Prisma applications
- Selective adoption - use RawSqlClient only where you need advanced SQL, keep regular Prisma everywhere else

### Perfect for Hybrid Architectures

```typescript
// Use Prisma for simple CRUD operations
const user = await prisma.user.create({ data: { name: 'John', email: 'john@example.com' } });

// Use RawSqlClient for complex queries that need structured JSON output
const client = new RawSqlClient(prisma);
const analytics = await client.query('reports/user-analytics.sql', {
  filter: { department: 'engineering' },
  serialize: true  // Auto-loads user-analytics.json mapping
});
```

> [!Note]
> This package is part of the rawsql-ts ecosystem. While this package is currently in beta, it provides stable integration with Prisma ORM for production use.

---

## � Installation

```bash
npm install @rawsql-ts/prisma-integration rawsql-ts @prisma/client
```

> [!Note]
> This package requires `@prisma/client` and `rawsql-ts` as peer dependencies.

---

## 🚀 Quick Start

### Basic Setup with Static Validation

```typescript
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

// Initialize Prisma client and rawsql-ts client
const prisma = new PrismaClient();
const client = new RawSqlClient(prisma, {
    sqlFilesPath: './sql',  // Your SQL files directory
    debug: true
});

// No manual initialization required - schema is loaded automatically when needed
```

### File-based SQL with JSON Mapping

Create your SQL file and corresponding JSON mapping:

```sql
-- sql/users/search.sql
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email,
    u.created_at,
    p.title as profile_title,
    p.bio as profile_bio
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.active = true
```

```json
// sql/users/search.json
{
  "rootName": "users",
  "rootEntity": {
    "id": "user",
    "name": "User",
    "columns": {
      "id": "user_id",
      "name": "user_name",
      "email": "email",
      "created": "created_at"
    }
  },
  "nestedEntities": [
    {
      "id": "profile",
      "parentId": "user",
      "propertyName": "profile",
      "relationshipType": "object",
      "columns": {
        "title": "profile_title",
        "bio": "profile_bio"
      }
    }
  ],
  "resultFormat": "array"
}
```

### Execute with Auto-loading JSON Mapping

```typescript
// Automatic JSON mapping loading and structured result
const users = await client.query('users/search.sql', {
  filter: {
    name: { ilike: '%john%' },
    created_at: { '>': '2024-01-01' }
  },
  sort: { created_at: { desc: true } },
  paging: { page: 1, pageSize: 20 },
  serialize: true  // Auto-loads search.json mapping
});

console.log(users);
// Returns structured JSON:
// [
//   {
//     "id": 1,
//     "name": "John Doe",
//     "email": "john@example.com",
//     "created": "2024-01-15T10:30:00Z",
//     "profile": {
//       "title": "Software Engineer",
//       "bio": "Passionate developer"
//     }
//   }
// ]
```

### Static Analysis & Validation

```typescript
// Validate SQL against Prisma schema
import { StaticAnalysisOrchestrator } from '@rawsql-ts/prisma-integration';

const orchestrator = new StaticAnalysisOrchestrator('./sql', './prisma/schema.prisma');
const report = await orchestrator.generateMarkdownFileSummary();
console.log(report);

// Use in unit tests for regression detection
const hasErrors = await orchestrator.hasValidationErrors();
expect(hasErrors).toBe(false);
```

> [!Note]
> SQL files should be created in the `./sql` directory (path configurable via the `sqlFilesPath` option). PrismaReader provides comprehensive query enhancement capabilities including dynamic filtering, sorting, pagination, and **hierarchical JSON transformation of flat SQL results**, thereby eliminating the need for manual object mapping procedures.

---

## PrismaReader Features

The `PrismaReader` class provides seamless integration between Prisma ORM and rawsql-ts, enabling you to execute SQL files with dynamic query capabilities. It automatically handles schema resolution, parameter injection, sorting, pagination, and JSON serialization.

Key benefits include:
- **SQL File Execution**: Load and execute SQL queries from files with automatic parameter handling
- **Dynamic Query Modification**: Apply filters, sorting, and pagination to base SQL queries
- **Schema-Aware Processing**: Automatically detects Prisma schema information for validation
- **JSON Serialization**: Transform flat SQL results into hierarchical JSON structures
- **Type-Safe Execution**: Full TypeScript support with proper error handling

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '@rawsql-ts/prisma-integration';

const prisma = new PrismaClient();
const reader = new PrismaReader(prisma, {
  debug: true,
  sqlFilesPath: './sql',
  defaultSchema: 'public'
});

// Schema information is loaded automatically when first query is executed

// Execute SQL file with comprehensive options
const results = await reader.query('complex-search.sql', {
  filter: {
    status: { in: ['active', 'premium'] },
    created_at: { '>=': '2024-01-01' },
    user_name: { ilike: '%john%' }
  },
  sort: {
    created_at: { desc: true, nullsLast: true },
    user_name: { asc: true }
  },
  paging: {
    page: 2,
    pageSize: 25
  },
  serialize: {
    rootName: 'user',
    rootEntity: { 
      id: 'user', 
      name: 'User', 
      columns: { id: 'user_id', name: 'user_name', email: 'email' }
    },
    nestedEntities: [
      { 
        id: 'profile', 
        parentId: 'user', 
        propertyName: 'profile', 
        relationshipType: 'object',
        columns: { title: 'profile_title', bio: 'profile_bio' }
      }
    ],
    useJsonb: true
  }
});

console.log(results);
// Returns hierarchical JSON with applied filters, sorting, and pagination
```

---

## Advanced Integration Examples

### SQL File-Based Query Execution

Create SQL files and execute them with dynamic modifications:

```typescript
// ./sql/users/search.sql
/*
SELECT 
    u.user_id,
    u.user_name,
    u.email,
    u.created_at,
    p.profile_title,
    COUNT(posts.post_id) as post_count
FROM users u
LEFT JOIN profiles p ON u.user_id = p.user_id
LEFT JOIN posts ON u.user_id = posts.author_id
WHERE u.active = true
GROUP BY u.user_id, u.user_name, u.email, u.created_at, p.profile_title
*/

import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '@rawsql-ts/prisma-integration';

const prisma = new PrismaClient();
const reader = new PrismaReader(prisma, {
  sqlFilesPath: './sql',
  debug: true
});

// Execute with dynamic filtering and pagination
const results = await reader.query('users/search.sql', {
  filter: {
    user_name: { ilike: '%alice%' },
    created_at: { '>=': '2024-01-01' }
  },
  sort: {
    post_count: { desc: true },
    user_name: { asc: true }
  },
  paging: {
    page: 1,
    pageSize: 10
  }
});
```

### Executing Pre-built Queries

Execute queries built with rawsql-ts components directly:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '@rawsql-ts/prisma-integration';
import { SelectQueryParser, SqlParamInjector } from 'rawsql-ts';

const prisma = new PrismaClient();
const reader = new PrismaReader(prisma);

// Build query using rawsql-ts components
const baseSql = 'SELECT user_id, user_name FROM users WHERE active = true';
const query = SelectQueryParser.parse(baseSql);

// Execute the pre-built query directly
const results = await reader.query(query);
```

### JSON Serialization

Transform flat SQL results into hierarchical JSON structures:

```typescript
const prisma = new PrismaClient();
const reader = new PrismaReader(prisma);

// Execute with JSON serialization
const results = await reader.query('users/detailed.sql', {
  serialize: {
    rootName: 'user',
    rootEntity: { 
      id: 'user', 
      name: 'User', 
      columns: { 
        id: 'user_id', 
        name: 'user_name', 
        email: 'email',
        createdAt: 'created_at'
      }
    },
    nestedEntities: [
      {
        id: 'profile',
        parentId: 'user',
        propertyName: 'profile',
        relationshipType: 'object',
        columns: { 
          title: 'profile_title', 
          bio: 'profile_bio' 
        }
      },
      {
        id: 'posts',
        parentId: 'user', 
        propertyName: 'posts',
        relationshipType: 'array',
        columns: { 
          id: 'post_id', 
          title: 'post_title', 
          content: 'post_content' 
        }
      }
    ],
    useJsonb: true
  }
});

// Results will be hierarchical JSON objects
console.log(results);
// Output: [
//   {
//     id: 1,
//     name: 'John Doe',
//     email: 'john@example.com',
//     profile: { title: 'Software Engineer', bio: '...' },
//     posts: [
//       { id: 1, title: 'Hello World', content: '...' },
//       { id: 2, title: 'TypeScript Tips', content: '...' }
//     ]
//   }
// ]
```

---

## Best Practices

### 1. PrismaReader Initialization
```typescript
// Initialize once and reuse throughout your application
const reader = new PrismaReader(prisma, {
  debug: process.env.NODE_ENV === 'development',
  sqlFilesPath: './sql'
});

// No manual initialization required - schema is loaded automatically when needed
```

### 2. Error Handling
```typescript
try {
  const results = await reader.query('users/search.sql', options);
} catch (error) {
  if (error.message.includes('SQL file not found')) {
    console.error('SQL file missing:', error.message);
  } else if (error.message.includes('SQL execution failed')) {
    console.error('Database error:', error.message);
  }
  throw error;
}
```
### 3. SQL File Organization
```typescript
// Organize SQL files by feature/module
// ./sql/users/search.sql
// ./sql/users/detail.sql
// ./sql/orders/list.sql
// ./sql/reports/monthly.sql

const reader = new PrismaReader(prisma, {
  sqlFilesPath: './sql'
});

// Use relative paths from sqlFilesPath
const userResults = await reader.query('users/search.sql', options);
const orderResults = await reader.query('orders/list.sql', options);
```

### TypeScript Type Safety

For enhanced type safety, import the QueryBuildOptions type:

```typescript
import { PrismaReader, QueryBuildOptions } from '@rawsql-ts/prisma-integration';

// Type-safe query options
const queryOptions: QueryBuildOptions = {
  filter: { status: 'active' },
  sort: { created_at: { desc: true } },
  paging: { page: 1, pageSize: 10 },
  serialize: { /* JsonMapping configuration */ }
};

const results = await reader.query('users/search.sql', queryOptions);
```

> [!Note]
> `QueryBuildOptions` is re-exported from rawsql-ts for your convenience, ensuring consistency across the entire rawsql-ts ecosystem. For detailed configuration examples of each option, refer to the [rawsql-ts usage guides](../../docs/usage-guides/).

---

## API Reference

### PrismaReader

| Method | Description | Returns |
|--------|-------------|---------|
| `constructor(prisma, options?)` | Create new PrismaReader instance | `PrismaReader` |
| `initialize()` | Initialize schema information (required) | `Promise<void>` |
| `query(sqlFile, options?)` | Execute SQL file with dynamic options | `Promise<T[]>` |
| `query(selectQuery)` | Execute pre-built SelectQuery object | `Promise<T[]>` |

### PrismaReaderOptions

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `debug` | `boolean` | Enable debug logging | `false` |
| `defaultSchema` | `string` | Default database schema name | `'public'` |
| `sqlFilesPath` | `string` | Base path for SQL files | `'./sql'` |

### QueryBuildOptions

This package uses rawsql-ts's standard `QueryBuildOptions` interface for consistent API design across the ecosystem.

| Option | Type | Description |
|--------|------|-------------|
| `filter` | `Record<string, any>` | Filter conditions to inject into WHERE clause ([SqlParamInjector Guide](../../docs/usage-guides/class-SqlParamInjector-usage-guide.md)) |
| `sort` | `SortConditions` | Sort conditions to inject into ORDER BY clause ([SqlSortInjector Guide](../../docs/usage-guides/class-SqlSortInjector-usage-guide.md)) |
| `paging` | `PaginationOptions` | Pagination options to inject LIMIT/OFFSET clauses ([SqlPaginationInjector Guide](../../docs/usage-guides/class-SqlPaginationInjector-usage-guide.md)) |
| `serialize` | `JsonMapping` | JSON serialization mapping to transform results into hierarchical JSON ([PostgresJsonQueryBuilder Guide](../../docs/usage-guides/class-PostgresJsonQueryBuilder-usage-guide.md)) |

> [!Note]
> `PaginationOptions` requires both `page: number` and `pageSize: number` to be specified for proper pagination.

For detailed usage examples and advanced configurations of each option, please refer to the linked rawsql-ts usage guides above.

---

## Examples Repository

For complete working examples and integration patterns, check out our examples repository:

- **[Prisma Comparison Demo](../../examples/prisma-comparison-demo/)** - Complete comparison between Prisma ORM and rawsql-ts approaches
- **[Todo API Demo](../../examples/todo-api-demo/)** - Real-world API implementation using Prisma integration

---

## Static Analysis and Validation

The prisma-integration package provides powerful static analysis capabilities to validate your SQL files, JSON mappings, and TypeScript domain models at development time.

### SQL Static Analysis

```typescript
import { StaticAnalysisOrchestrator } from 'rawsql-ts/prisma-integration';

// Analyze all SQL files in a directory
const orchestrator = new StaticAnalysisOrchestrator('./sql-files', './prisma/schema.prisma');

// Generate comprehensive analysis report
const report = await orchestrator.generateMarkdownFileSummary();
console.log(report);

// Check for any validation errors
const hasErrors = await orchestrator.hasValidationErrors();
if (hasErrors) {
    console.error('Validation errors found! Please check the report.');
    process.exit(1);
}
```

### Automated Regression Testing

Create comprehensive unit tests that automatically validate your SQL files against your Prisma schema:

```typescript
// tests/sql-static-analysis.test.ts
import { describe, it, expect } from 'vitest';
import { StaticAnalysisOrchestrator } from 'rawsql-ts/prisma-integration';
import { glob } from 'glob';

describe('SQL Static Analysis', () => {
    it('should validate all SQL files without errors', async () => {
        const orchestrator = new StaticAnalysisOrchestrator('./rawsql-ts', './prisma/schema.prisma');
        
        // Generate and display the analysis report
        const report = await orchestrator.generateMarkdownFileSummary();
        console.log(report);
        
        // Fail the test if any validation errors are found
        const hasErrors = await orchestrator.hasValidationErrors();
        expect(hasErrors).toBe(false);
    });

    it('should validate individual SQL files with detailed error reporting', async () => {
        const orchestrator = new StaticAnalysisOrchestrator('./rawsql-ts', './prisma/schema.prisma');
        
        // Get all SQL files
        const sqlFiles = await glob('./rawsql-ts/**/*.sql');
        
        for (const sqlFile of sqlFiles) {
            // Analyze each file individually for detailed error reporting
            try {
                const analysis = await orchestrator.analyzeSqlFile(sqlFile);
                
                // Log any warnings or issues found
                if (analysis.warnings?.length > 0) {
                    console.warn(`Warnings in ${sqlFile}:`, analysis.warnings);
                }
                
                // Ensure no critical errors exist
                expect(analysis.errors?.length || 0).toBe(0);
            } catch (error) {
                throw new Error(`Failed to analyze ${sqlFile}: ${error.message}`);
            }
        }
    });

    it('should validate JSON mappings match domain models', async () => {
        const orchestrator = new StaticAnalysisOrchestrator('./rawsql-ts', './prisma/schema.prisma');
        
        // Validate that JSON mappings align with TypeScript interfaces
        const mappingFiles = await glob('./rawsql-ts/**/*.json');
        
        for (const mappingFile of mappingFiles) {
            const validation = await orchestrator.validateJsonMapping(mappingFile);
            
            expect(validation.isValid).toBe(true);
            
            if (!validation.isValid) {
                console.error(`Invalid JSON mapping in ${mappingFile}:`, validation.errors);
            }
        }
    });    });
});
```

### JSON Schema Validation

```typescript
import { JsonSchemaValidator } from '@rawsql-ts/prisma-integration';

// Validate JSON mapping files
const validator = new JsonSchemaValidator();
const jsonMapping = JSON.parse(fs.readFileSync('./mappings/users.json', 'utf8'));

try {
    const isValid = validator.validate(jsonMapping);
    console.log('JSON mapping is valid:', isValid);
} catch (error) {
    console.error('JSON validation failed:', error.message);
}

```typescript
import { JsonSchemaValidator } from 'rawsql-ts/prisma-integration';

// Validate JSON mapping files
const validator = new JsonSchemaValidator();
const jsonMapping = JSON.parse(fs.readFileSync('./mappings/users.json', 'utf8'));

try {
    const isValid = validator.validate(jsonMapping);
    console.log('JSON mapping is valid:', isValid);
} catch (error) {
    console.error('JSON validation failed:', error.message);
}
```

---

## DynamicQueryBuilder Integration

Seamlessly integrate with rawsql-ts's `DynamicQueryBuilder` for unified query building:

```typescript
import { DynamicQueryBuilder } from 'rawsql-ts';
import { PrismaReader } from 'rawsql-ts/prisma-integration';

const prisma = new PrismaClient();
const reader = new PrismaReader(prisma);

// Create a DynamicQueryBuilder with Prisma schema awareness
const tableColumnResolver = reader.createTableColumnResolver();
const builder = new DynamicQueryBuilder(tableColumnResolver);

// Build dynamic queries with auto-loading JSON serialization
const users = await reader.loadQuery('getUsers.sql', {
    filter: { status: 'active', age: { min: 18 } },
    sort: { created_at: { desc: true } },
    paging: { page: 1, pageSize: 20 },
    serialize: true  // Auto-loads getUsers.json mapping
});

console.log(users); // Structured JSON result
```

---

## License

MIT - see the [LICENSE](../../LICENSE) file for details.

---

## Related Packages

- **[rawsql-ts](../core/)** - Core SQL parsing and transformation library
- **[@rawsql-ts/examples](../examples/)** - Additional integration examples and demos

## Documentation Links

- **[rawsql-ts Usage Guides](../../docs/usage-guides/)** - Comprehensive guides for each component
  - [DynamicQueryBuilder](../../docs/usage-guides/class-DynamicQueryBuilder-usage-guide.md) - All-in-one query building solution
  - [SqlParamInjector](../../docs/usage-guides/class-SqlParamInjector-usage-guide.md) - Dynamic filter injection
  - [SqlSortInjector](../../docs/usage-guides/class-SqlSortInjector-usage-guide.md) - ORDER BY clause generation
  - [SqlPaginationInjector](../../docs/usage-guides/class-SqlPaginationInjector-usage-guide.md) - LIMIT/OFFSET pagination
  - [PostgresJsonQueryBuilder](../../docs/usage-guides/class-PostgresJsonQueryBuilder-usage-guide.md) - Hierarchical JSON serialization
  - [SqlSchemaValidator](../../docs/usage-guides/class-SqlSchemaValidator-usage-guide.md) - Schema validation and static analysis

---

Feel free to explore the power of rawsql-ts with Prisma integration! Questions, feature requests, and bug reports are always welcome.
