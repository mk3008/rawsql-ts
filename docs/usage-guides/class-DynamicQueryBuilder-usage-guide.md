# DynamicQueryBuilder Class Usage Guide

## Overview

The `DynamicQueryBuilder` class is a powerful, all-in-one solution that combines SQL parsing with dynamic condition injection (filtering, sorting, pagination, and JSON serialization). It provides a unified interface for building complex queries without the need to manually chain multiple injectors, making it ideal for modern web applications that require flexible, dynamic query generation.

## Basic Usage

### 1. Basic Query Building

```typescript
import { DynamicQueryBuilder, SqlFormatter } from 'rawsql-ts';

// Simple example with filtering
const baseQuery = 'SELECT id, name, email FROM users WHERE active = true';
const options = {
    filter: { status: 'premium', age: { min: 18 } },
    sort: { created_at: { desc: true } },
    paging: { page: 1, pageSize: 20 }
};

const builder = new DynamicQueryBuilder();
const dynamicQuery = builder.buildQuery(baseQuery, options);

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(dynamicQuery);

console.log(formattedSql);
// Output: select "id", "name", "email" from "users" 
//         where "active" = true and "status" = :status and "age" >= :age_min
//         order by "created_at" desc
//         limit :paging_limit offset :paging_offset

console.log(params);
// Output: { status: 'premium', age_min: 18, paging_limit: 20, paging_offset: 0 }
```

### 2. Using TableColumnResolver for Schema-aware Queries

```typescript
// Define table column resolver for schema validation
const tableColumnResolver = (tableName: string): string[] => {
    const schemas = {
        users: ['id', 'name', 'email', 'status', 'created_at', 'age'],
        orders: ['id', 'user_id', 'total', 'order_date']
    };
    return schemas[tableName] || [];
};

const builder = new DynamicQueryBuilder(tableColumnResolver);
const query = builder.buildQuery('SELECT * FROM users', {
    filter: { name: 'Alice' }
});
// TableColumnResolver helps resolve wildcard SELECT and validates column existence
```

## Query Building Options

### QueryBuildOptions Interface

```typescript
interface QueryBuildOptions {
    filter?: Record<string, any>;     // Filter conditions for WHERE clause
    sort?: SortConditions;            // Sort conditions for ORDER BY clause  
    paging?: PaginationOptions;       // Pagination for LIMIT/OFFSET clauses
    serialize?: JsonMapping | boolean; // JSON serialization mapping
}
```

### 1. Filtering Options

The `filter` option supports all `SqlParamInjector` features:

```typescript
const filterOptions = {
    filter: {
        // Basic equality
        status: 'active',
        
        // Range conditions
        age: { min: 18, max: 65 },
        
        // Pattern matching
        name: { ilike: '%john%' },
        
        // IN clauses
        category_id: { in: [1, 2, 3] },
        
        // OR conditions
        search_term: {
            or: [
                { column: 'name', ilike: '%search%' },
                { column: 'email', ilike: '%search%' }
            ]
        }
    }
};
```

### 2. Sorting Options

The `sort` option supports all `SqlSortInjector` features:

```typescript
const sortOptions = {
    sort: {
        created_at: { desc: true, nullsLast: true },
        name: { asc: true },
        priority: { desc: true, nullsFirst: true }
    }
};
```

### 3. Pagination Options

The `paging` option supports all `SqlPaginationInjector` features:

```typescript
const pagingOptions = {
    paging: {
        page: 2,        // Page number (1-based)
        pageSize: 25    // Items per page
    }
};
```

### 4. JSON Serialization Options

The `serialize` option supports `PostgresJsonQueryBuilder` features:

```typescript
const serializeOptions = {
    serialize: {
        rootName: 'user',
        rootEntity: {
            id: 'user',
            name: 'User',
            columns: { id: 'id', name: 'name', email: 'email' }
        },
        nestedEntities: [
            {
                id: 'orders',
                parentId: 'user',
                propertyName: 'orders',
                relationshipType: 'array',
                columns: { id: 'order_id', total: 'total_amount' }
            }
        ]
    }
};

// Or use boolean for auto-loading (when integrated with PrismaReader)
const autoSerialize = { serialize: true };
```

## Convenience Methods

### 1. Single-Purpose Query Building

```typescript
const builder = new DynamicQueryBuilder();

// Filter only
const filteredQuery = builder.buildFilteredQuery(baseQuery, { status: 'active' });

// Sort only  
const sortedQuery = builder.buildSortedQuery(baseQuery, { created_at: { desc: true } });

// Pagination only
const paginatedQuery = builder.buildPaginatedQuery(baseQuery, { page: 2, pageSize: 10 });

// JSON serialization only
const serializedQuery = builder.buildSerializedQuery(baseQuery, jsonMapping);
```

### 2. SQL Validation

```typescript
const builder = new DynamicQueryBuilder();

// Validate SQL without applying modifications
try {
    const isValid = builder.validateSql('SELECT id, name FROM users');
    console.log('SQL is valid:', isValid); // true
} catch (error) {
    console.error('Invalid SQL:', error.message);
}

// Example with invalid SQL
try {
    builder.validateSql('SELCT * FRM invalid_table'); // typos
} catch (error) {
    console.error('Validation failed:', error.message);
    // "Invalid SQL: Unexpected token 'SELCT'"
}
```

## Advanced Usage

### 1. Complete Dynamic Query Example

```typescript
import { DynamicQueryBuilder, SqlFormatter } from 'rawsql-ts';

const builder = new DynamicQueryBuilder();

// Complex query with all features
const baseQuery = `
    SELECT u.id, u.name, u.email, u.status, u.created_at,
           o.id as order_id, o.total, o.order_date
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.active = true
`;

const options = {
    filter: {
        status: 'premium',
        created_at: { min: '2024-01-01' },
        search: {
            or: [
                { column: 'name', ilike: '%john%' },
                { column: 'email', ilike: '%john%' }
            ]
        }
    },
    sort: {
        created_at: { desc: true },
        name: { asc: true }
    },
    paging: {
        page: 1,
        pageSize: 50
    },
    serialize: {
        rootName: 'users',
        rootEntity: {
            id: 'user',
            name: 'User',
            columns: { id: 'id', name: 'name', email: 'email', status: 'status', created: 'created_at' }
        },
        nestedEntities: [
            {
                id: 'orders',
                parentId: 'user', 
                propertyName: 'orders',
                relationshipType: 'array',
                columns: { id: 'order_id', total: 'total', date: 'order_date' }
            }
        ]
    }
};

const result = builder.buildQuery(baseQuery, options);
const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(result);

console.log('Generated JSON Query:');
console.log(formattedSql);
console.log('Parameters:', params);
```

### 2. Chaining with Other Injectors

While `DynamicQueryBuilder` handles most use cases, you can still combine it with individual injectors for specific scenarios:

```typescript
// Start with DynamicQueryBuilder for most features
let query = builder.buildQuery(baseQuery, {
    filter: { status: 'active' },
    sort: { created_at: { desc: true } }
});

// Add custom transformations if needed
const customInjector = new SqlParamInjector();
query = customInjector.inject(query, { custom_field: 'value' });
```

### 3. Framework Integration Example

```typescript
// Express.js API endpoint example
app.get('/api/users', (req, res) => {
    const builder = new DynamicQueryBuilder(tableColumnResolver);
    
    // Extract query parameters
    const options = {
        filter: req.query.filter ? JSON.parse(req.query.filter) : {},
        sort: req.query.sort ? JSON.parse(req.query.sort) : {},
        paging: {
            page: parseInt(req.query.page) || 1,
            pageSize: Math.min(parseInt(req.query.pageSize) || 20, 100)
        },
        serialize: req.query.format === 'json' ? userJsonMapping : undefined
    };
    
    try {
        const query = builder.buildQuery(baseUserQuery, options);
        const formatter = new SqlFormatter();
        const { formattedSql, params } = formatter.format(query);
        
        // Execute query with your database client
        const results = await db.query(formattedSql, params);
        res.json(results);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
```

## Performance Considerations

### 1. Optimal Order of Operations

`DynamicQueryBuilder` applies transformations in the optimal order for performance:

1. **Filtering first** - Reduces dataset size as early as possible
2. **Sorting second** - Sorts the filtered (smaller) dataset  
3. **Pagination third** - Limits the sorted results
4. **Serialization last** - Transforms the final result structure

### 2. Reusing Builder Instances

```typescript
// Builder instances are stateless and can be reused
const builder = new DynamicQueryBuilder(tableColumnResolver);

// Safe to reuse for multiple queries
const query1 = builder.buildQuery(sql1, options1);
const query2 = builder.buildQuery(sql2, options2);
```

### 3. TableColumnResolver Caching

```typescript
// Cache table metadata for better performance
const tableCache = new Map();
const cachedResolver = (tableName: string): string[] => {
    if (!tableCache.has(tableName)) {
        tableCache.set(tableName, getColumnsFromDatabase(tableName));
    }
    return tableCache.get(tableName);
};

const builder = new DynamicQueryBuilder(cachedResolver);
```

## Error Handling

### 1. SQL Parsing Errors

```typescript
try {
    const query = builder.buildQuery('INVALID SQL', options);
} catch (error) {
    console.error('Failed to parse SQL:', error.message);
    // Handle parsing errors appropriately
}
```

### 2. Validation Errors

```typescript
try {
    const query = builder.buildQuery(sql, {
        paging: { page: -1, pageSize: 10000 } // Invalid values
    });
} catch (error) {
    console.error('Validation error:', error.message);
    // Handle validation errors
}
```

## Best Practices

### 1. Use TypeScript for Type Safety

```typescript
import { QueryBuildOptions, SortConditions, PaginationOptions } from 'rawsql-ts';

// Define typed interfaces for your use case
interface UserQueryOptions extends QueryBuildOptions {
    filter?: {
        status?: string;
        age?: { min?: number; max?: number };
        name?: { ilike?: string };
    };
    sort?: SortConditions;
    paging?: PaginationOptions;
}

const options: UserQueryOptions = {
    filter: { status: 'active' },
    sort: { created_at: { desc: true } },
    paging: { page: 1, pageSize: 20 }
};
```

### 2. Validate Input Parameters

```typescript
function buildUserQuery(baseQuery: string, userOptions: any) {
    // Validate and sanitize user input
    const options: QueryBuildOptions = {
        filter: sanitizeFilter(userOptions.filter),
        sort: validateSort(userOptions.sort),
        paging: {
            page: Math.max(1, parseInt(userOptions.page) || 1),
            pageSize: Math.min(100, Math.max(1, parseInt(userOptions.pageSize) || 20))
        }
    };
    
    return builder.buildQuery(baseQuery, options);
}
```

### 3. Use Schema Validation

```typescript
// Always provide tableColumnResolver for production use
const builder = new DynamicQueryBuilder(tableColumnResolver);

// This helps catch column name typos and schema mismatches early
```

## Migration from Individual Injectors

If you're currently using individual injectors, you can easily migrate to `DynamicQueryBuilder`:

### Before (Individual Injectors):
```typescript
let query = SelectQueryParser.parse(baseQuery);
query = new SqlParamInjector().inject(query, filterParams);
query = new SqlSortInjector().inject(query, sortParams);  
query = new SqlPaginationInjector().inject(query, pagingParams);
```

### After (DynamicQueryBuilder):
```typescript
const query = new DynamicQueryBuilder().buildQuery(baseQuery, {
    filter: filterParams,
    sort: sortParams,
    paging: pagingParams
});
```

## Related Classes

- **SqlParamInjector**: For filtering functionality details
- **SqlSortInjector**: For sorting functionality details  
- **SqlPaginationInjector**: For pagination functionality details
- **PostgresJsonQueryBuilder**: For JSON serialization functionality details
- **SqlFormatter**: For query formatting and parameter extraction
- **SelectQueryParser**: For SQL parsing functionality
