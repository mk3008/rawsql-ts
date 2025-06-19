# RawSqlClient Usage Guide

## Overview

`RawSqlClient` is the main interface for executing SQL queries with auto-serialization support in the `@msugiura/rawsql-prisma` package. It provides a simple, type-safe way to execute file-based SQL queries and transform results into structured JSON objects.

## Core Methods

### `queryOne<T>(sqlPath, params?)`

Executes a SQL query and returns a single result or null. Always enables serialization if a JSON mapping file exists.

```typescript
const user = await client.queryOne<User>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});
// Returns: User | null
```

### `queryMany<T>(sqlPath, params?)`

Executes a SQL query and returns an array of results. Always enables serialization if a JSON mapping file exists.

```typescript
const todos = await client.queryMany<Todo>('todos/search.sql', { 
  filter: { status: 'pending' } 
});
// Returns: Todo[]
```

### `query<T>(sqlPath, params?, options?)`

Low-level query method with full control over serialization and result handling.

```typescript
const result = await client.query<Todo[]>('todos/search.sql', 
  { filter: { status: 'pending' } }, 
  { serialize: true }
);
```

## JSON Mapping and Auto-Serialization

### How It Works

When you call `queryOne<T>()` or `queryMany<T>()`, the client automatically looks for a `.json` mapping file alongside your `.sql` file:

```
sql/
  users/
    get-profile.sql     ← SQL query
    get-profile.json    ← JSON mapping (auto-loaded)
```

### JSON Mapping Structure

The JSON mapping file defines how flat SQL results should be transformed into hierarchical JSON structures:

```json
{
  "user": {
    "id": "user_id",
    "name": "user_name",
    "email": "user_email"
  },
  "posts": [
    {
      "id": "post_id",
      "title": "post_title",
      "content": "post_content",
      "createdAt": "post_created_at"
    }
  ]
}
```

### SQL Query Example

```sql
-- users/get-profile.sql
SELECT 
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,
  p.id as post_id,
  p.title as post_title,
  p.content as post_content,
  p.created_at as post_created_at
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.id = :userId
```

### TypeScript Usage

```typescript
interface UserProfile {
  user: {
    id: number;
    name: string;
    email: string;
  };
  posts: Array<{
    id: number;
    title: string;
    content: string;
    createdAt: string;
  }>;
}

const profile = await client.queryOne<UserProfile>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});
```

## Advanced Features

### Conditional Serialization

For the `query<T>()` method, serialization is controlled by options:

```typescript
// Auto-detect: enables serialization if .json file exists
const result1 = await client.query<User>('users/get-profile.sql', { 
  filter: { userId: 123 } 
});

// Force enable serialization
const result2 = await client.query<User>('users/get-profile.sql', 
  { filter: { userId: 123 } }, 
  { serialize: true }
);

// Force disable serialization
const result3 = await client.query<any[]>('users/get-profile.sql', 
  { filter: { userId: 123 } }, 
  { serialize: false }
);
```

### Error Handling

```typescript
try {
  const user = await client.queryOne<User>('users/get-profile.sql', { 
    filter: { userId: 123 } 
  });
  if (!user) {
    console.log('User not found');
  }
} catch (error) {
  console.error('Query failed:', error);
}
```

## Best Practices

### 1. Use Descriptive File Names

```
sql/
  users/
    get-profile.sql          ← Clear purpose
    search-by-department.sql ← Descriptive action
  orders/
    get-recent-orders.sql    ← Specific scope
```

### 2. Structure Your Mapping Files

Keep your JSON mappings simple and focused:

```json
{
  "order": {
    "id": "order_id",
    "total": "order_total",
    "status": "order_status"
  },
  "items": [
    {
      "id": "item_id",
      "name": "item_name",
      "quantity": "item_quantity",
      "price": "item_price"
    }
  ],
  "customer": {
    "id": "customer_id",
    "name": "customer_name"
  }
}
```

### 3. Prefer `queryOne` and `queryMany`

These methods provide clearer intent and automatic serialization:

```typescript
// ✅ Clear intent: expecting single result
const user = await client.queryOne<User>('users/get-by-id.sql', { id: 123 });

// ✅ Clear intent: expecting multiple results
const users = await client.queryMany<User>('users/search.sql', { department: 'IT' });

// ❌ Less clear: what type of result do we expect?
const result = await client.query<User>('users/get-by-id.sql', { id: 123 });
```

## Integration Examples

### With Existing Prisma Code

```typescript
// Traditional Prisma
const userPrisma = await prisma.user.findUnique({
  where: { id: userId },
  include: { posts: true, comments: true }
});

// RawSqlClient for complex queries
const userAnalytics = await client.queryOne<UserAnalytics>(
  'analytics/user-engagement.sql', 
  { userId, dateRange: '30d' }
);
```

### In API Routes (Next.js)

```typescript
// pages/api/users/[id]/profile.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  const profile = await client.queryOne<UserProfile>('users/get-profile.sql', { 
    userId: parseInt(id as string) 
  });
  
  if (!profile) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(profile);
}
```

## Troubleshooting

### JSON Mapping Not Working

1. Ensure the `.json` file is in the same directory as the `.sql` file
2. Check that the JSON structure matches your TypeScript interface
3. Verify that SQL column aliases match the mapping keys

### Type Safety Issues

1. Use explicit TypeScript interfaces for your result types
2. Ensure your SQL column aliases are consistent with your JSON mapping
3. Test your queries with unit tests to catch type mismatches early

## Related Guides

- [SQL File Organization Guide](./sql-file-organization-guide.md)
- [TypeScript Integration Guide](./typescript-integration-guide.md)
- [SQL Schema Validator Guide](./class-SqlSchemaValidator-usage-guide.md)
