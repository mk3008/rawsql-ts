# SqlPaginationInjector Class Usage Guide

## Overview

The `SqlPaginationInjector` class dynamically injects LIMIT and OFFSET clauses into SQL queries, providing a clean and efficient way to handle data pagination. Instead of manually constructing different SQL statements for various page numbers and page sizes, you can inject pagination into your base SQL query, making your code more maintainable and performance-optimized.

## Basic Usage

### 1. Basic Pagination Injection

```typescript
import { SqlPaginationInjector, SqlFormatter } from 'rawsql-ts';

// Simple example
const sql = `SELECT id, name, email FROM users WHERE active = true`;
const pagination = {
    page: 2,        // Page number (1-based)
    pageSize: 20    // Items per page
};

const injector = new SqlPaginationInjector();
const paginatedQuery = injector.inject(sql, pagination);

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(paginatedQuery);

console.log(formattedSql);
// Output: select "id", "name", "email" from "users" where "active" = true limit :paging_limit offset :paging_offset

console.log(params);
// Output: { paging_limit: 20, paging_offset: 20 }
```

### 2. Using Parsed Query Objects

```typescript
import { SelectQueryParser, SqlPaginationInjector } from 'rawsql-ts';

const baseQuery = SelectQueryParser.parse('select u.user_id, u.user_name from users as u');
const pagination = { page: 3, pageSize: 15 };

const injector = new SqlPaginationInjector();
const paginatedQuery = injector.inject(baseQuery, pagination);
```

## Pagination Options

### Basic Configuration
- `page`: Page number (1-based, required)
- `pageSize`: Number of items per page (required, max 1000)

```typescript
const pagination = {
    page: 1,        // First page
    pageSize: 25    // 25 items per page
};
```

## Advanced Features

### 1. Consistent Query Structure for Better Caching

SqlPaginationInjector now always includes both LIMIT and OFFSET clauses for all pages to ensure consistent SQL query structure, which improves database query plan caching and prepared statement reuse:

```typescript
// All pages now generate consistent SQL structure
const firstPage = { page: 1, pageSize: 20 };
const result = injector.inject(baseQuery, firstPage);
// Generated SQL: SELECT ... LIMIT :paging_limit OFFSET :paging_offset
// Parameters: { paging_limit: 20, paging_offset: 0 }

const secondPage = { page: 2, pageSize: 20 };
const result2 = injector.inject(baseQuery, secondPage);
// Generated SQL: SELECT ... LIMIT :paging_limit OFFSET :paging_offset  
// Parameters: { paging_limit: 20, paging_offset: 20 }
```

**Benefits of Consistent Structure:**
- **Better Database Performance**: Same SQL structure allows database to reuse query plans
- **Improved Prepared Statement Efficiency**: Single cached statement for all pagination requests  
- **Consistent Behavior**: Predictable SQL output regardless of page number
- **Reduced Parsing Overhead**: Database doesn't need to parse different SQL variations

### 2. Remove Existing Pagination

Use the static `removePagination` method to clean existing LIMIT/OFFSET clauses:

```typescript
const existingPaginatedSql = 'SELECT id, name FROM users LIMIT 50 OFFSET 100';

// Remove existing pagination
const cleanQuery = SqlPaginationInjector.removePagination(existingPaginatedSql);
// Result: SELECT id, name FROM users

// Apply new pagination
const newPagination = { page: 1, pageSize: 25 };
const repaginatedQuery = injector.inject(cleanQuery, newPagination);

// Format with SqlFormatter to see the final SQL
const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(repaginatedQuery);
// formattedSql: SELECT id, name FROM users LIMIT :paging_limit OFFSET :paging_offset
// params: { paging_limit: 25, paging_offset: 0 }
```

### 3. Preserve Other Clauses

SqlPaginationInjector preserves all existing clauses except LIMIT/OFFSET:

```typescript
const complexSql = `
    SELECT u.id, u.name, u.email, COUNT(o.order_id) as order_count
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.active = true
    GROUP BY u.id, u.name, u.email
    HAVING COUNT(o.order_id) > 0
    ORDER BY u.name ASC
`;

const pagination = { page: 2, pageSize: 10 };
const result = injector.inject(complexSql, pagination);
// All clauses preserved with LIMIT 10 OFFSET 10 added at the end
```

## Error Handling

### 1. Invalid Page Number

```typescript
try {
    const injector = new SqlPaginationInjector();
    injector.inject('SELECT id FROM users', { page: 0, pageSize: 20 });
} catch (error) {
    console.error(error.message); // "Page number must be a positive integer (1 or greater)"
}
```

### 2. Invalid Page Size

```typescript
try {
    const injector = new SqlPaginationInjector();
    injector.inject('SELECT id FROM users', { page: 1, pageSize: 1001 });
} catch (error) {
    console.error(error.message); // "Page size cannot exceed 1000 items"
}
```

### 3. Existing Pagination Detected

```typescript
try {
    const injector = new SqlPaginationInjector();
    injector.inject('SELECT id FROM users LIMIT 10', { page: 1, pageSize: 20 });
} catch (error) {
    console.error(error.message); // "Query already contains LIMIT or OFFSET clause"
}
```

## Combining with SqlFormatter

Queries generated by SqlPaginationInjector can be beautifully formatted using SqlFormatter:

```typescript
import { SqlFormatter } from 'rawsql-ts';

const formatter = new SqlFormatter({
    parameterSymbol: ":",
    parameterStyle: "named",
    indentSize: 4,
    indentChar: " ",
    newline: "\n",
    keywordCase: "lower",
    commaBreak: "before",
    andBreak: "before"
});

const { formattedSql } = formatter.format(paginatedQuery);
```

## Practical Examples

### E-commerce Product Listing with Pagination

```typescript
import { SqlPaginationInjector } from 'rawsql-ts';

const productQuery = `
  SELECT 
    p.product_id,
    p.product_name,
    p.price,
    p.stock_quantity,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
  WHERE p.active = true
  ORDER BY p.created_at DESC
`;

// User requests page 5 with 12 products per page
const userPagination = {
    page: 5,
    pageSize: 12
};

const injector = new SqlPaginationInjector();
const paginatedProducts = injector.inject(productQuery, userPagination);
// Generates: ... ORDER BY p.created_at DESC LIMIT 12 OFFSET 48
```

### API Endpoint with Dynamic Pagination

```typescript
import { SqlPaginationInjector } from 'rawsql-ts';

function getUsersEndpoint(req: { query: { page?: string, limit?: string } }) {
    const baseQuery = `
        SELECT 
            u.user_id, 
            u.username, 
            u.email, 
            u.last_login,
            u.created_at
        FROM users u
        WHERE u.deleted_at IS NULL
        ORDER BY u.created_at DESC
    `;
    
    // Parse pagination from request
    const pagination = {
        page: parseInt(req.query.page || '1'),
        pageSize: Math.min(parseInt(req.query.limit || '20'), 100) // Cap at 100
    };
    
    const injector = new SqlPaginationInjector();
    const paginatedQuery = injector.inject(baseQuery, pagination);
    
    return paginatedQuery;
}
```

### Combining with Other Injectors

```typescript
import { SqlParamInjector, SqlSortInjector, SqlPaginationInjector } from 'rawsql-ts';

function buildDynamicQuery(filters: any, sorting: any, pagination: any) {
    const baseQuery = `
        SELECT u.id, u.name, u.email, u.status, u.created_at
        FROM users u
        WHERE u.deleted_at IS NULL
    `;
    
    // Apply transformations in order
    let query = baseQuery;
    
    // 1. Apply filters
    if (filters && Object.keys(filters).length > 0) {
        const paramInjector = new SqlParamInjector();
        query = paramInjector.inject(query, filters);
    }
    
    // 2. Apply sorting
    if (sorting && Object.keys(sorting).length > 0) {
        const sortInjector = new SqlSortInjector();
        query = sortInjector.inject(query, sorting);
    }
    
    // 3. Apply pagination
    if (pagination) {
        const pageInjector = new SqlPaginationInjector();
        query = pageInjector.inject(query, pagination);
    }
    
    return query;
}

// Example usage
const dynamicQuery = buildDynamicQuery(
    { status: 'active', name: { ilike: '%john%' } },  // Filters
    { created_at: { desc: true }, name: { asc: true } }, // Sorting
    { page: 2, pageSize: 25 }  // Pagination
);
```

### Report Generation with Configurable Pagination

```typescript
import { SqlPaginationInjector } from 'rawsql-ts';

class ReportGenerator {
    private injector = new SqlPaginationInjector();
    
    generateSalesReport(config: { page: number, pageSize: number, period: string }) {
        const baseQuery = `
            SELECT 
                DATE_TRUNC('day', order_date) as sale_date,
                COUNT(*) as order_count,
                SUM(total_amount) as revenue,
                AVG(total_amount) as avg_order_value
            FROM orders
            WHERE order_date >= CURRENT_DATE - INTERVAL '${config.period}'
            GROUP BY DATE_TRUNC('day', order_date)
            ORDER BY sale_date DESC
        `;
        
        const pagination = {
            page: config.page,
            pageSize: Math.min(config.pageSize, 1000) // Safety limit
        };
        
        return this.injector.inject(baseQuery, pagination);
    }
    
    generateCustomerReport(page: number, pageSize: number = 50) {
        const customerQuery = `
            SELECT 
                c.customer_id,
                c.customer_name,
                c.email,
                COUNT(o.order_id) as total_orders,
                SUM(o.total_amount) as lifetime_value,
                MAX(o.order_date) as last_order_date
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.customer_name, c.email
            ORDER BY lifetime_value DESC NULLS LAST
        `;
        
        return this.injector.inject(customerQuery, { page, pageSize });
    }
}
```

## Important Notes

1. **Page Numbering**: Page numbers are 1-based (first page is page 1, not 0)
2. **Page Size Limits**: Maximum page size is 1000 items to prevent performance issues
3. **OFFSET Optimization**: Page 1 queries omit OFFSET 0 for better readability
4. **Existing Clauses**: Automatically detects and prevents conflicts with existing LIMIT/OFFSET
5. **Query Scope**: Only works with SimpleSelectQuery (single SELECT statements)
6. **Order Preservation**: All existing clauses are preserved; LIMIT/OFFSET are appended at the end
7. **Validation**: Built-in validation ensures positive integers and reasonable limits

## Performance Considerations and Limitations

- **Large Offsets**: Be aware that large OFFSET values can impact performance on large datasets
- **Alternative Strategies**: For high-performance pagination on large datasets, consider cursor-based pagination
- **Index Usage**: Ensure proper indexing on ORDER BY columns for optimal performance
- **Page Size**: Smaller page sizes generally perform better and provide better user experience
- **Database Limits**: Some databases have maximum OFFSET limits; consult your database documentation

## Comparison with Other Injectors

| Feature | SqlParamInjector | SqlSortInjector | SqlPaginationInjector |
|---------|------------------|-----------------|----------------------|
| Target Clause | WHERE | ORDER BY | LIMIT/OFFSET |
| Query Scope | Upstream search (CTE/Subquery) | Current query only | Current query only |
| Complex Queries | Supported | SimpleSelectQuery only | SimpleSelectQuery only |
| Append Mode | Adds to WHERE | Appends to ORDER BY | Appends LIMIT/OFFSET |
| Use Case | Dynamic filtering | Dynamic sorting | Data pagination |
| Performance Impact | Filter early | Sort optimization | Offset considerations |
