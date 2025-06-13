# @rawsql-ts/prisma-integration

![npm version](https://img.shields.io/npm/v/@rawsql-ts/prisma-integration)
![npm downloads](https://img.shields.io/npm/dm/@rawsql-ts/prisma-integration)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

🌐 [Documentation & Examples](https://mk3008.github.io/rawsql-ts/)

Prisma integration package for rawsql-ts that provides powerful database schema reading capabilities and seamless integration with Prisma ORM. This package enables you to leverage Prisma's schema introspection to build dynamic SQL queries with full type safety and automatic hierarchical JSON serialization.

> [!Note]
> This package is part of the rawsql-ts ecosystem. While this package is currently in beta, it provides stable integration with Prisma ORM for production use.

## Key Features

> [!Important]
> This package is designed for **PostgreSQL databases only**. The hierarchical JSON serialization feature leverages PostgreSQL-specific JSON functions and capabilities.

### Core Capabilities
- **🔍 Prisma Schema Reader**: Automatically extract table and column information from Prisma schema for rawsql-ts components
- **🛡️ Type-Safe Integration**: Full TypeScript support leveraging Prisma's generated types and schema definitions  
- **📊 Hierarchical JSON Serialization**: Transform flat SQL results into nested JSON structures using PostgreSQL JSON functions and Prisma relationship metadata
- **⚡ Zero-Config Schema Detection**: Automatic schema resolution from your existing Prisma setup
- **🔧 Dynamic Parameter Injection**: Safe SQL parameter handling with schema-aware validation
- **📈 Advanced Query Building**: Built-in support for filtering, sorting, pagination with Prisma table metadata
- **🌐 Framework Agnostic**: Works with any Node.js application using Prisma, not limited to specific frameworks

### Architecture Benefits
This library enables **SQL-side DTO implementation** without requiring complex SQL. You simply write **flat, general-purpose SQL queries**, and the library handles all the complexity:

- **📝 Simple Development**: Write straightforward, flat SELECT queries - no complex JOINs or nested queries required
- **🔍 Automatic Processing**: All filtering, sorting, pagination, and hierarchical structuring handled by the library
- **🏗️ Domain-Driven Design**: Return domain schemas directly without being constrained by table structure
- **🚀 Performance Optimization**: Generate hierarchical JSON at the database level using PostgreSQL's native JSON capabilities
- **🎯 API-like Database Access**: Treat your database as a flexible data service with minimal SQL complexity

---

## Installation

```bash
npm install @rawsql-ts/prisma-integration rawsql-ts @prisma/client
```

> [!Note]
> This package requires `@prisma/client` and `rawsql-ts` as peer dependencies.

---

## Quick Start

Transform flat SQL results into hierarchical JSON with dynamic query capabilities:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaReader } from '@rawsql-ts/prisma-integration';

// Initialize Prisma client and reader
const prisma = new PrismaClient();
const reader = new PrismaReader(prisma);

// Initialize schema information
await reader.initialize();

// Execute SQL file with dynamic options + JSON serialization
const results = await reader.query('users/search.sql', {
  filter: {
    user_name: { ilike: '%john%' },
    created_at: { '>': '2024-01-01' },
    status: 'active'
  },
  sort: {
    created_at: { desc: true },
    user_name: { asc: true }
  },
  paging: {
    page: 1,
    pageSize: 20
  },
  serialize: {
    rootName: 'user',
    rootEntity: { 
      id: 'user', 
      name: 'User', 
      columns: { 
        id: 'user_id', 
        name: 'user_name', 
        email: 'email' 
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
          title: 'post_title' 
        }
      }
    ],
    useJsonb: true
  }
});

console.log(results);
// Outputs hierarchical JSON instead of flat rows:
// [
//   {
//     "id": 1,
//     "name": "John Doe", 
//     "email": "john@example.com",
//     "profile": {
//       "title": "Software Engineer",
//       "bio": "Passionate developer..."
//     },
//     "posts": [
//       { "id": 1, "title": "Getting Started with TypeScript" },
//       { "id": 2, "title": "Advanced SQL Techniques" }
//     ]
//   }
// ]
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

// Initialize schema information
await reader.initialize();

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

await reader.initialize();

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
const prisma = new PrismaClient();
const reader = new PrismaReader(prisma);

await reader.initialize();

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

await reader.initialize();

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

// Always call initialize() after creation
await reader.initialize();
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
  throw error;### 3. SQL File Organization
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

## License

MIT - see the [LICENSE](../../LICENSE) file for details.

---

## Related Packages

- **[rawsql-ts](../core/)** - Core SQL parsing and transformation library
- **[@rawsql-ts/examples](../examples/)** - Additional integration examples and demos

## Documentation Links

- **[rawsql-ts Usage Guides](../../docs/usage-guides/)** - Comprehensive guides for each component
  - [SqlParamInjector](../../docs/usage-guides/class-SqlParamInjector-usage-guide.md) - Dynamic filter injection
  - [SqlSortInjector](../../docs/usage-guides/class-SqlSortInjector-usage-guide.md) - ORDER BY clause generation
  - [SqlPaginationInjector](../../docs/usage-guides/class-SqlPaginationInjector-usage-guide.md) - LIMIT/OFFSET pagination
  - [PostgresJsonQueryBuilder](../../docs/usage-guides/class-PostgresJsonQueryBuilder-usage-guide.md) - Hierarchical JSON serialization

---

Feel free to explore the power of rawsql-ts with Prisma integration! Questions, feature requests, and bug reports are always welcome.
