# SqlSortInjector Class Usage Guide

## Overview

The `SqlSortInjector` class dynamically injects ORDER BY clauses into SQL queries, providing a flexible way to handle sorting requirements. Instead of manually constructing different SQL statements for various sorting scenarios, you can inject sort conditions into your base SQL query, making your code more maintainable and reusable.

## Basic Usage

### 1. Basic Sort Injection

```typescript
import { SqlSortInjector, SqlFormatter } from 'rawsql-ts';

// Simple example
const sql = `SELECT id, name, created_at FROM users WHERE active = true`;
const sortConditions = {
    created_at: { desc: true },
    name: { asc: true }
};

const injector = new SqlSortInjector();
const sortedQuery = injector.inject(sql, sortConditions);

const formatter = new SqlFormatter();
const { formattedSql } = formatter.format(sortedQuery);

console.log(formattedSql);
// Output: select "id", "name", "created_at" from "users" where "active" = true order by "created_at" desc, "name"
```

### 2. Using Parsed Query Objects

```typescript
import { SelectQueryParser, SqlSortInjector } from 'rawsql-ts';

const baseQuery = SelectQueryParser.parse('select u.user_id, u.user_name from users as u');
const sortConditions = { user_name: { asc: true } };

const injector = new SqlSortInjector();
const sortedQuery = injector.inject(baseQuery, sortConditions);
```

## Supported Sort Options

### Sort Direction Options
- `asc`: Ascending order (can be omitted as it's the default)
- `desc`: Descending order

### NULLS Position Options
- `nullsFirst`: NULLS FIRST - null values appear first
- `nullsLast`: NULLS LAST - null values appear last

```typescript
const sortConditions = {
    price: { 
        desc: true,          // Price in descending order
        nullsLast: true      // NULL prices appear last
    },
    name: { 
        asc: true,           // Name in ascending order (explicit)
        nullsFirst: true     // NULL names appear first
    },
    created_at: {
        nullsLast: true      // Only NULLS position (defaults to ASC)
    }
};
```

## Advanced Features

### 1. Append to Existing ORDER BY

SqlSortInjector preserves existing ORDER BY clauses and appends new conditions:

```typescript
const existingSql = 'SELECT id, name, age FROM users ORDER BY id ASC';
const additionalSort = {
    name: { desc: true },
    age: { asc: true }
};

const injector = new SqlSortInjector();
const result = injector.inject(existingSql, additionalSort);

// Generated SQL: SELECT id, name, age FROM users ORDER BY id ASC, name DESC, age ASC
```

### 2. Remove Existing ORDER BY

Use the static `removeOrderBy` method to clean existing ORDER BY clauses:

```typescript
const sqlWithOrder = 'SELECT id, name FROM users ORDER BY id ASC, name DESC';

// Remove existing ORDER BY
const cleanQuery = SqlSortInjector.removeOrderBy(sqlWithOrder);
// Result: SELECT id, name FROM users

// Apply new sorting
const newSortConditions = { name: { desc: true } };
const newSortedQuery = injector.inject(cleanQuery, newSortConditions);
// Result: SELECT id, name FROM users ORDER BY name DESC
```

### 3. Column Alias Support

SqlSortInjector works seamlessly with column aliases:

```typescript
const sql = 'SELECT user_id AS id, user_name AS name, email FROM users';
const sortConditions = {
    id: { asc: true },      // Uses alias 'id' (maps to user_id)
    name: { desc: true }    // Uses alias 'name' (maps to user_name)
};

const injector = new SqlSortInjector();
const result = injector.inject(sql, sortConditions);
// Generated SQL: SELECT user_id AS id, user_name AS name, email FROM users ORDER BY user_id ASC, user_name DESC
```

### 4. Calculated Expression Aliases

Works with calculated expressions and complex aliases:

```typescript
const sql = `
    SELECT 
        *,
        CASE WHEN age > 18 THEN 'adult' ELSE 'minor' END AS category,
        EXTRACT(YEAR FROM created_at) AS created_year
    FROM users
`;

const sortConditions = {
    category: { desc: true },      // Sort by calculated expression
    created_year: { asc: true }    // Sort by extracted year
};

const injector = new SqlSortInjector();
const result = injector.inject(sql, sortConditions);
// Uses the full calculated expressions in ORDER BY clause
```

### 5. Custom Table Column Resolver

When your SQL uses wildcards (like `SELECT *`) or omits column names, `rawsql-ts` cannot resolve columns by itself because it only parses the SQL string and does not know the actual database schema.

To handle this, provide a **TableColumnResolver** function. This function returns an array of column names for a given table name, allowing `rawsql-ts` to resolve wildcards and inject sort conditions accurately.

```typescript
// Example: Custom column resolution function
const customResolver = (tableName: string) => {
    if (tableName.toLowerCase() === 'users') {
        return ['user_id', 'name', 'email', 'created_at'];
    }
    if (tableName.toLowerCase() === 'products') {
        return ['product_id', 'product_name', 'price', 'category_id'];
    }
    return [];
};

const injector = new SqlSortInjector(customResolver);

// Now works with SELECT *
const sql = 'SELECT * FROM users';
const sortConditions = {
    name: { asc: true },
    created_at: { desc: true }
};

const result = injector.inject(sql, sortConditions);
```

## Error Handling

### 1. Column Not Found

```typescript
try {
    const injector = new SqlSortInjector();
    injector.inject('SELECT id, name FROM users', { 
        nonexistent_column: { asc: true } 
    });
} catch (error) {
    console.error(error.message); // "Column or alias 'nonexistent_column' not found in current query"
}
```

### 2. Conflicting Sort Directions

```typescript
try {
    const injector = new SqlSortInjector();
    injector.inject('SELECT id, name FROM users', { 
        name: { asc: true, desc: true } 
    });
} catch (error) {
    console.error(error.message); // "Conflicting sort directions for column 'name': both asc and desc specified"
}
```

### 3. Conflicting NULLS Positions

```typescript
try {
    const injector = new SqlSortInjector();
    injector.inject('SELECT id, name FROM users', { 
        name: { nullsFirst: true, nullsLast: true } 
    });
} catch (error) {
    console.error(error.message); // "Conflicting nulls positions for column 'name': both nullsFirst and nullsLast specified"
}
```

### 4. Empty Sort Condition

```typescript
try {
    const injector = new SqlSortInjector();
    injector.inject('SELECT id, name FROM users', { 
        name: {} 
    });
} catch (error) {
    console.error(error.message); // "Empty sort condition for column 'name': at least one sort option must be specified"
}
```

### 5. Complex Query Not Supported

SqlSortInjector only works with SimpleSelectQuery (single SELECT statements):

```typescript
try {
    const injector = new SqlSortInjector();
    injector.inject('SELECT id FROM users UNION SELECT id FROM admins', { 
        id: { asc: true } 
    });
} catch (error) {
    console.error(error.message); // Error about complex queries not being supported
}
```

## Combining with SqlFormatter

Queries generated by SqlSortInjector can be beautifully formatted using SqlFormatter:

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

const { formattedSql } = formatter.format(sortedQuery);
```

## Practical Examples

### E-commerce Product Listing

```typescript
import { SqlSortInjector } from 'rawsql-ts';

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
`;

// User-selected sorting options
const userSortPreferences = {
    price: { desc: true, nullsLast: true },    // Expensive items first, nulls last
    stock_quantity: { asc: true },             // Low stock first (for restocking)
    product_name: { asc: true }                // Alphabetical as final sort
};

const injector = new SqlSortInjector();
const sortedProducts = injector.inject(productQuery, userSortPreferences);
```

### User Management Dashboard

```typescript
import { SqlSortInjector } from 'rawsql-ts';

const userQuery = `
  SELECT 
    u.user_id, 
    u.username, 
    u.email, 
    u.last_login,
    u.created_at,
    u.status
  FROM users u
  WHERE u.deleted_at IS NULL
`;

// Admin dashboard sorting
const adminSortSettings = {
    status: { desc: true },                    // Active users first
    last_login: { desc: true, nullsLast: true }, // Recent logins first, never logged in last
    created_at: { desc: true }                 // Newest users first
};

const injector = new SqlSortInjector();
const sortedUsers = injector.inject(userQuery, adminSortSettings);
```

### Report Generation with Dynamic Sorting

```typescript
import { SqlSortInjector } from 'rawsql-ts';

const salesReportQuery = `
  SELECT 
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*) AS order_count,
    SUM(total_amount) AS revenue,
    AVG(total_amount) AS avg_order_value
  FROM orders
  WHERE order_date >= '2024-01-01'
  GROUP BY DATE_TRUNC('month', order_date)
`;

// Different sorting for different report types
const revenueReportSort = {
    revenue: { desc: true },                   // Highest revenue months first
    month: { asc: true }                       // Then chronological
};

const orderVolumeSort = {
    order_count: { desc: true },               // Highest order volume first
    avg_order_value: { desc: true }            // Then highest average value
};

const injector = new SqlSortInjector();

// Generate different sorted reports
const revenueReport = injector.inject(salesReportQuery, revenueReportSort);
const volumeReport = injector.inject(salesReportQuery, orderVolumeSort);
```

### Flexible Data Export with User Preferences

```typescript
import { SqlSortInjector } from 'rawsql-ts';

const exportQuery = `
  SELECT 
    c.customer_id,
    c.company_name,
    c.contact_name,
    c.email,
    c.country,
    COUNT(o.order_id) AS total_orders,
    SUM(o.total_amount) AS lifetime_value
  FROM customers c
  LEFT JOIN orders o ON c.customer_id = o.customer_id
  GROUP BY c.customer_id, c.company_name, c.contact_name, c.email, c.country
`;

// User can customize export sorting
function generateCustomerExport(userSortPreferences: any) {
    const injector = new SqlSortInjector();
    
    // Always remove existing ORDER BY and apply user preferences
    const cleanQuery = SqlSortInjector.removeOrderBy(exportQuery);
    const sortedExport = injector.inject(cleanQuery, userSortPreferences);
    
    return sortedExport;
}

// Example user preferences
const exportByValue = generateCustomerExport({
    lifetime_value: { desc: true, nullsLast: true },
    total_orders: { desc: true }
});

const exportByName = generateCustomerExport({
    company_name: { asc: true },
    contact_name: { asc: true }
});

const exportByCountry = generateCustomerExport({
    country: { asc: true },
    lifetime_value: { desc: true }
});
```

## Important Notes

1. **Query Scope**: SqlSortInjector only searches for columns in the current query (no upstream CTE/subquery search like SqlParamInjector)
2. **SimpleSelectQuery Only**: Only works with simple SELECT statements, not UNION, INTERSECT, or other complex query types
3. **Column Resolution**: Uses the same column resolution logic as SqlParamInjector for consistency
4. **Alias Priority**: Column aliases take precedence over original column names
5. **Append Mode**: New sort conditions are appended to existing ORDER BY clauses
6. **Default Direction**: When no direction is specified, ASC is used as default
7. **NULLS Positioning**: NULLS FIRST/LAST is only added when explicitly specified

## Performance Considerations and Limitations

- SqlSortInjector performs column validation against the current query only
- Complex expressions in ORDER BY may impact query performance
- When using wildcard selection (e.g., `SELECT *`), column names cannot be determined without a TableColumnResolver
- Large numbers of sort conditions may affect SQL readability
- Always consider database indexing when applying multiple sort conditions

## Comparison with SqlParamInjector

| Feature | SqlParamInjector | SqlSortInjector |
|---------|------------------|-----------------|
| Target Clause | WHERE | ORDER BY |
| Query Scope | Upstream search (CTE/Subquery) | Current query only |
| Complex Queries | Supported | SimpleSelectQuery only |
| Append Mode | Adds to WHERE | Appends to ORDER BY |
| Column Resolution | Full upstream tree | Current query columns |
| Use Case | Dynamic filtering | Dynamic sorting |
