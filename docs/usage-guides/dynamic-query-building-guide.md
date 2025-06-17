# Dynamic Query Building Guide

This guide covers how to use dynamic query building features in `@rawsql-ts/prisma-integration` to modify SQL queries at runtime with filters, sorting, and pagination.

## Overview

Dynamic query building allows you to start with a base SQL query and enhance it with:
- **Filters**: Dynamic WHERE clause conditions
- **Sorting**: Dynamic ORDER BY clauses
- **Pagination**: Automatic LIMIT/OFFSET calculation
- **Parameter injection**: Safe parameter binding

All modifications are applied safely without SQL injection risks.

## Basic Dynamic Filtering

### Simple Filter Conditions

```typescript
// Base SQL query: users/search.sql
/*
SELECT id, name, email, created_at, is_active
FROM users
WHERE 1=1  -- Placeholder for dynamic conditions
*/

const client = new RawSqlClient(prisma, { sqlFilesPath: './sql' });

// Add dynamic filter conditions
const users = await client.queryMany<User>('users/search.sql', {
  filter: {
    name: 'John Doe',           // WHERE name = 'John Doe'
    is_active: true,            // AND is_active = true
    created_at: {               // AND created_at >= '2024-01-01'
      '>=': '2024-01-01'
    }
  }
});
```

### Comparison Operators

```typescript
const users = await client.queryMany<User>('users/search.sql', {
  filter: {
    // Equality
    name: 'John',                    // name = 'John'
    
    // Comparison operators
    age: { '>': 18 },               // age > 18
    created_at: { '<=': new Date() }, // created_at <= NOW
    
    // Range operators
    salary: { 
      '>=': 50000, 
      '<=': 100000 
    },                              // salary >= 50000 AND salary <= 100000
    
    // Pattern matching
    email: { 
      ilike: '%@company.com' 
    },                              // email ILIKE '%@company.com'
    
    // Array conditions
    department: { 
      in: ['Engineering', 'Design'] 
    },                              // department IN ('Engineering', 'Design')
    
    status: { 
      not_in: ['deleted', 'banned'] 
    },                              // status NOT IN ('deleted', 'banned')
    
    // Null checks
    phone: { is_null: true },       // phone IS NULL
    address: { is_not_null: true }  // address IS NOT NULL
  }
});
```

### Complex Filter Combinations

```typescript
// Advanced filtering with nested conditions
const results = await client.queryMany<User>('users/advanced-search.sql', {
  filter: {
    // Multiple conditions on same field (AND logic)
    created_at: {
      '>=': '2024-01-01',
      '<': '2024-12-31'
    },
    
    // Array-based OR logic (requires special SQL structure)
    $or: [
      { name: { ilike: '%john%' } },
      { email: { ilike: '%john%' } }
    ],
    
    // Nested object filtering
    'profile.title': { ilike: '%engineer%' },
    'profile.experience_years': { '>': 5 }
  }
});
```

## Dynamic Sorting

### Basic Sorting

```typescript
const sortedUsers = await client.queryMany<User>('users/list.sql', {
  sort: {
    created_at: { desc: true },     // ORDER BY created_at DESC
    name: { asc: true }             // THEN BY name ASC
  }
});
```

### Advanced Sorting Options

```typescript
const results = await client.queryMany<User>('users/list.sql', {
  sort: {
    // Basic sorting
    name: { asc: true },
    
    // Null handling
    last_login: { 
      desc: true, 
      nullsLast: true 
    },                              // ORDER BY last_login DESC NULLS LAST
    
    // Multiple field sorting (order matters)
    department: { asc: true },
    salary: { desc: true },
    created_at: { asc: true }       // Executed in this order
  }
});
```

### Dynamic Sort Field Selection

```typescript
interface SortOptions {
  field: 'name' | 'created_at' | 'salary' | 'department';
  direction: 'asc' | 'desc';
  nullsLast?: boolean;
}

function buildDynamicSort(options: SortOptions[]) {
  const sort: any = {};
  
  options.forEach(option => {
    sort[option.field] = {
      [option.direction]: true,
      ...(option.nullsLast && { nullsLast: true })
    };
  });
  
  return sort;
}

// Usage
const sortOptions: SortOptions[] = [
  { field: 'department', direction: 'asc' },
  { field: 'salary', direction: 'desc', nullsLast: true }
];

const users = await client.queryMany<User>('users/list.sql', {
  sort: buildDynamicSort(sortOptions)
});
```

## Dynamic Pagination

### Basic Pagination

```typescript
const page1Users = await client.queryMany<User>('users/list.sql', {
  paging: {
    page: 1,        // First page (1-based)
    pageSize: 20    // 20 records per page
  }
});
// Generates: LIMIT 20 OFFSET 0

const page2Users = await client.queryMany<User>('users/list.sql', {
  paging: {
    page: 2,        // Second page
    pageSize: 20    // 20 records per page  
  }
});
// Generates: LIMIT 20 OFFSET 20
```

### Pagination with Total Count

```typescript
// For getting total count, create a corresponding count query
// users/list-count.sql
/*
SELECT COUNT(*) as total
FROM users
WHERE 1=1  -- Same base conditions as main query
*/

async function getPaginatedUsers(page: number, pageSize: number, filters?: any) {
  const [users, countResult] = await Promise.all([
    client.queryMany<User>('users/list.sql', {
      filter: filters,
      paging: { page, pageSize }
    }),
    client.queryOne<{ total: number }>('users/list-count.sql', {
      filter: filters
    })
  ]);

  const total = countResult.total;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}

// Usage
const result = await getPaginatedUsers(1, 10, {
  is_active: true,
  department: { in: ['Engineering', 'Design'] }
});
```

## Combining All Features

### Complete Dynamic Query Example

```typescript
// Complex query combining all dynamic features
const searchResults = await client.queryMany<UserSearchResult>('users/comprehensive-search.sql', {
  // Dynamic filtering
  filter: {
    name: { ilike: `%${searchTerm}%` },
    created_at: { 
      '>=': startDate,
      '<=': endDate 
    },
    department: { in: allowedDepartments },
    is_active: true,
    'profile.experience_years': { '>=': minExperience }
  },
  
  // Dynamic sorting
  sort: {
    relevance_score: { desc: true },     // Custom calculated field
    created_at: { desc: true },
    name: { asc: true }
  },
  
  // Pagination
  paging: {
    page: currentPage,
    pageSize: itemsPerPage
  }
});
```

### Reusable Query Builder Service

```typescript
interface QueryOptions<T> {
  filters?: Record<string, any>;
  sorting?: Array<{
    field: keyof T;
    direction: 'asc' | 'desc';
    nullsLast?: boolean;
  }>;
  pagination?: {
    page: number;
    pageSize: number;
  };
}

class DynamicQueryService {
  constructor(private client: RawSqlClient) {}

  async executeQuery<T>(
    sqlFile: string,
    options: QueryOptions<T> = {}
  ): Promise<T[]> {
    const { filters, sorting, pagination } = options;

    // Build sort object
    const sort: any = {};
    if (sorting) {
      sorting.forEach(s => {
        sort[s.field] = {
          [s.direction]: true,
          ...(s.nullsLast && { nullsLast: true })
        };
      });
    }

    return this.client.queryMany<T>(sqlFile, {
      filter: filters || {},
      sort,
      paging: pagination
    });
  }

  async searchUsers(criteria: UserSearchCriteria): Promise<User[]> {
    return this.executeQuery<User>('users/search.sql', {
      filters: {
        name: criteria.name ? { ilike: `%${criteria.name}%` } : undefined,
        department: criteria.departments ? { in: criteria.departments } : undefined,
        is_active: criteria.activeOnly ? true : undefined
      },
      sorting: [
        { field: 'name', direction: 'asc' },
        { field: 'created_at', direction: 'desc' }
      ],
      pagination: criteria.pagination
    });
  }
}
```

## SQL Query Requirements

### Base Query Structure

Your SQL queries need to follow certain patterns to work with dynamic features:

```sql
-- users/search.sql - Base query structure
SELECT 
    u.id,
    u.name,
    u.email,
    u.created_at,
    u.is_active,
    p.title as profile_title
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE 1=1  -- Important: placeholder for dynamic WHERE conditions
    -- You can include static conditions here
    AND u.deleted_at IS NULL
-- ORDER BY clause will be added dynamically
-- LIMIT/OFFSET will be added dynamically
```

### Advanced SQL Patterns

```sql
-- users/advanced-search.sql - With subqueries and CTEs
WITH user_stats AS (
    SELECT 
        user_id,
        COUNT(*) as post_count,
        AVG(rating) as avg_rating
    FROM posts
    GROUP BY user_id
)
SELECT 
    u.id,
    u.name,
    u.email,
    u.created_at,
    COALESCE(us.post_count, 0) as post_count,
    COALESCE(us.avg_rating, 0) as avg_rating
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
LEFT JOIN profiles p ON u.id = p.user_id
WHERE 1=1  -- Dynamic conditions will be injected here
    AND u.deleted_at IS NULL
-- Complex queries work with dynamic features too
```

## Performance Considerations

### Indexing for Dynamic Queries

```sql
-- Create indexes for commonly filtered columns
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_active_created ON users(is_active, created_at);

-- Composite indexes for common filter combinations
CREATE INDEX idx_users_dept_active_created ON users(department, is_active, created_at);
```

### Query Optimization Tips

```typescript
// 1. Limit the number of returned fields in SELECT queries
const users = await client.queryMany<BasicUser>('users/list-basic.sql', {
  filter: { is_active: true },
  paging: { page: 1, pageSize: 20 }
});

// 2. Use appropriate page sizes
const RECOMMENDED_PAGE_SIZE = 20; // Good balance of performance and UX

// 3. Cache frequently used queries
const cachedResults = await cacheManager.getOrSet(
  `users:${JSON.stringify(filters)}:${page}`,
  () => client.queryMany<User>('users/search.sql', options),
  300 // 5 minutes TTL
);
```

## Error Handling

### Common Dynamic Query Errors

```typescript
try {
  const users = await client.queryMany<User>('users/search.sql', {
    filter: { invalid_column: 'value' }
  });
} catch (error) {
  if (error.message.includes('column "invalid_column" does not exist')) {
    // Handle column name errors
    throw new Error('Invalid filter field specified');
  }
  
  if (error.message.includes('syntax error')) {
    // Handle SQL syntax errors from dynamic injection
    throw new Error('Invalid query parameters');
  }
  
  throw error; // Re-throw unknown errors
}
```

### Input Validation

```typescript
function validateQueryOptions(options: any) {
  // Validate pagination
  if (options.paging) {
    if (options.paging.page < 1) {
      throw new Error('Page number must be >= 1');
    }
    if (options.paging.pageSize < 1 || options.paging.pageSize > 1000) {
      throw new Error('Page size must be between 1 and 1000');
    }
  }

  // Validate sort fields
  if (options.sort) {
    const validSortFields = ['name', 'created_at', 'department', 'salary'];
    Object.keys(options.sort).forEach(field => {
      if (!validSortFields.includes(field)) {
        throw new Error(`Invalid sort field: ${field}`);
      }
    });
  }
}

// Use validation before queries
validateQueryOptions(queryOptions);
const results = await client.queryMany<User>('users/search.sql', queryOptions);
```

Dynamic query building provides powerful runtime flexibility while maintaining SQL injection safety and type safety through the `@rawsql-ts/prisma-integration` package.
