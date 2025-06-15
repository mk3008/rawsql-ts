# SqlParamInjector Class Usage Guide

## Overview

The `SqlParamInjector` class dynamically injects parameters into SQL queries and automatically generates WHERE conditions. Based on the provided state object, it constructs appropriate WHERE clauses and generates parameterized queries.

## Basic Usage

### 1. Basic Parameter Injection

```typescript
import { SqlParamInjector, SqlFormatter } from 'rawsql-ts';

// Simple example
const sql = `SELECT id, name FROM users WHERE active = true`;
const injector = new SqlParamInjector();
const injectedQuery = injector.inject(sql, { id: 42, name: 'Alice' });

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(injectedQuery);

console.log(formattedSql);
// Output: SELECT "id", "name" FROM "users" WHERE "active" = true AND "id" = :id AND "name" = :name

console.log(params);
// Output: { id: 42, name: 'Alice' }
```

### 2. Using Parsed Query Objects

```typescript
import { SelectQueryParser, SqlParamInjector } from 'rawsql-ts';

const baseQuery = SelectQueryParser.parse('select u.user_id from users as u');
const state = { user_id: 10 };

const injector = new SqlParamInjector();
const injectedQuery = injector.inject(baseQuery, state);
```

### 3. Security: Preventing Accidental Full-Table Queries

By default, `SqlParamInjector` prevents potentially dangerous situations where all parameters are `undefined`, which would result in fetching all records from the database:

```typescript
// This will throw an error by default
const state = { id: undefined, name: undefined };
const injector = new SqlParamInjector();

try {
    injector.inject(sql, state);
} catch (error) {
    console.error(error.message);
    // "All parameters are undefined. This would result in fetching all records. Use allowAllUndefined: true option to explicitly allow this behavior."
}

// To explicitly allow this behavior, use the allowAllUndefined option
const safeInjector = new SqlParamInjector({ allowAllUndefined: true });
const result = safeInjector.inject(sql, state);
// This will succeed and return the query without WHERE conditions
```

## Supported Types

### Primitive Types
- `number`: Numeric values
- `string`: String values  
- `boolean`: Boolean values
- `Date`: Date objects
- `null`: NULL values (explicitly generates NULL conditions)
- `undefined`: Ignored (not added to WHERE conditions)

### Complex Condition Objects

You can use condition operators for detailed searches:

```typescript
const state = {
    price: {
        min: 10,        // price >= 10
        max: 100,       // price <= 100
        '=': 50,        // price = 50
        '>': 20,        // price > 20
        '<': 80,        // price < 80
        '>=': 15,       // price >= 15
        '<=': 95,       // price <= 95
        '!=': 30,       // price != 30
        '<>': 40        // price <> 40
    },
    name: {
        ilike: '%john%'  // name ILIKE '%john%' (case-insensitive)
    },
    category_id: {
        in: [1, 2, 3]   // category_id IN (1, 2, 3)
    },
    tags: {
        any: [100, 200] // tags = ANY([100, 200]) (PostgreSQL array operator)
    }
};
```

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `price = 100` |
| `min` | Greater than or equal (converted to >=) | `price >= 10` |
| `max` | Less than or equal (converted to <=) | `price <= 100` |
| `like` | Pattern matching (case-sensitive) | `name LIKE '%john%'` |
| `ilike` | Pattern matching (case-insensitive) | `name ILIKE '%JOHN%'` |
| `in` | IN clause | `id IN (1, 2, 3)` |
| `any` | ANY operator | `tags = ANY([100, 200])` |
| `<` | Less than | `price < 50` |
| `>` | Greater than | `price > 20` |
| `<=` | Less than or equal | `price <= 100` |
| `>=` | Greater than or equal | `price >= 10` |
| `!=` | Not equal | `price != 50` |
| `<>` | Not equal | `price <> 50` |

## Advanced Condition Syntax

### 1. Automatic Parentheses Grouping

When multiple operators are specified for the same column, they are automatically wrapped in parentheses to ensure correct SQL logic:

```typescript
const state = {
    price: {
        min: 10,      // price >= 10
        max: 100,     // price <= 100
        '!=': 50      // price != 50
    }
};

// Generated SQL: WHERE (price >= :price_min AND price <= :price_max AND price != :price_neq)
```

### 2. OR Conditions

Use the `or` array syntax to create OR conditions across different columns or with different operators:

```typescript
const state = {
    search: {
        or: [
            { column: 'first_name', ilike: '%john%' },
            { column: 'last_name', ilike: '%smith%' },
            { column: 'email', like: '%@example.com' }
        ]
    }
};

// Generated SQL: WHERE (first_name ILIKE :search_or_0_ilike OR last_name ILIKE :search_or_1_ilike OR email LIKE :search_or_2_like)
```

### 3. Explicit AND Conditions

Use the `and` array syntax for explicit AND grouping:

```typescript
const state = {
    search_criteria: {
        and: [
            { column: 'name', like: '%phone%' },
            { column: 'price', min: 100 },
            { column: 'category_id', '=': 5 }
        ]
    }
};

// Generated SQL: WHERE name LIKE :search_criteria_and_0_like AND price >= :search_criteria_and_1_min AND category_id = :search_criteria_and_2_eq
```

### 4. Explicit Column Mapping

Map parameter names to different column names using the `column` property:

```typescript
const state = {
    user_name: {                    // Parameter name
        column: 'u_name',           // Actual column name
        like: '%Alice%'
    },
    price_range: {
        column: 'prc',              // Map to 'prc' column
        min: 100,
        max: 1000
    }
};

// Generated SQL: WHERE u_name LIKE :user_name_like AND (prc >= :price_range_min AND prc <= :price_range_max)
```


## Column Search Scope and Upstream Injection (CTE/Subquery Awareness)

`SqlParamInjector` can search for columns not only in the root query, but also in upstream sources like CTEs (Common Table Expressions) and subqueries. When you specify a parameter, the injector traverses the query tree upward to find the first occurrence of the column, ensuring the condition is injected at the most appropriate level.

This approach ensures WHERE conditions are applied as close to the data source as possible, which improves both correctness and SQL performance by minimizing unnecessary data processing.

> [Note!] Injecting conditions into upstream queries (such as CTEs or subqueries) can significantly reduce the amount of data processed in later stages, leading to better performance. This is a unique and powerful feature of `rawsql-ts`.

## Advanced Features

### 1. Case and Underscore Insensitive Matching

```typescript
// Treat columnName and column_name as identical
const injector = new SqlParamInjector({ ignoreCaseAndUnderscore: true });

const query = 'SELECT article_id, article_name FROM articles';
const state = { articleId: 100 }; // Matches article_id

const result = injector.inject(query, state);
```

### 2. AllowAllUndefined Option

For safety, `SqlParamInjector` prevents accidental full-table queries by throwing an error when all parameters are `undefined`. Use the `allowAllUndefined` option to explicitly allow this behavior:

```typescript
// Configuration options
const injector = new SqlParamInjector({ 
    ignoreCaseAndUnderscore: true,  // Allow flexible column name matching
    allowAllUndefined: true         // Allow queries when all params are undefined
});

// This will not throw an error even if all parameters are undefined
const state = { user_id: undefined, name: undefined };
const result = injector.inject('SELECT * FROM users', state);
// Returns the original query without WHERE conditions
```


### 3. Custom Table Column Resolver

When your SQL uses wildcards (like `SELECT *`) or omits column names, `rawsql-ts` cannot resolve columns by itself because it only parses the SQL string and does not know the actual database schema.

To handle this, provide a **TableColumnResolver** function. This function returns an array of column names for a given table name, allowing `rawsql-ts` to expand wildcards and inject parameters accurately—even when column names are missing from the SQL.

This is especially useful for queries with `*`, views, or dynamic SQL, and is essential for correct parameter injection and transformation in offline or static analysis.

```typescript
// Example: Custom column resolution function
const customResolver = (tableName: string) => {
    if (tableName.toLowerCase() === 'users') {
        return ['user_id', 'name', 'email', 'created_at'];
    }
    if (tableName.toLowerCase() === 'articles') {
        return ['price', 'article_name', 'category_id', 'tags'];
    }
    return [];
};

const injector = new SqlParamInjector(customResolver);
```

### 4. Complex Condition Example

In real-world scenarios, search conditions are often more than just simple equality checks. With SqlParamInjector, you can specify a variety of conditions for each column, such as ranges (min/max), pattern matching (like), set membership (in/any), and not-equal conditions. You can also combine multiple conditions for a single column.

Below is an example showing how to provide complex, multi-condition filters for a query:

```typescript
const complexState = {
    price: {
        min: 10,      // price >= 10
        max: 100,     // price <= 100
        '!=': 50      // price != 50
    },
    article_name: {
        ilike: '%premium%'  // Case-insensitive search
    },
    category_id: {
        in: [1, 2, 3, 4]
    },
    tags: {
        any: [100, 200, 300]
    }
};

const tableColumnResolver = (tableName: string) => {
    if (tableName.toLowerCase() === 'articles') {
        return ['price', 'article_name', 'category_id', 'tags'];
    }
    return [];
};

const injector = new SqlParamInjector(tableColumnResolver);
const result = injector.inject(
    'SELECT * FROM articles a',
    complexState
);

// This will generate a SQL WHERE clause with all the specified conditions combined:
// SELECT * FROM articles a 
// WHERE 
//   a.price >= :price_min AND 
//   a.price <= :price_max AND 
//   a.price != :price_neq AND
//   a.article_name ILIKE :article_name_ilike AND
//   a.category_id IN (:category_id_in_0, :category_id_in_1, :category_id_in_2, :category_id_in_3) AND
//   a.tags = ANY(:tags_any)
```

## CTE (Common Table Expression) Support

SqlParamInjector supports complex query structures:

```typescript
const sql = `
  WITH cte_users AS (
    SELECT id, name FROM users WHERE active = true
  )
  SELECT * FROM (
    SELECT id AS user_id, name AS user_name FROM cte_users
  ) AS sub
`;

const state = { 
    id: 42,        // Matches id column in CTE
    user_id: 100   // Matches user_id in subquery
};

const injector = new SqlParamInjector();
const result = injector.inject(sql, state);
```

## Error Handling

### 1. All Parameters Undefined (Security Check)

```typescript
try {
    const injector = new SqlParamInjector();
    injector.inject('SELECT name FROM users', { name: undefined, email: undefined });
} catch (error) {
    console.error(error.message); 
    // "All parameters are undefined. This would result in fetching all records. Use allowAllUndefined: true option to explicitly allow this behavior."
}
```

### 2. Column Not Found

```typescript
try {
    const injector = new SqlParamInjector();
    injector.inject('SELECT name FROM users', { nonexistent_column: 'value' });
} catch (error) {
    console.error(error.message); // "Column 'nonexistent_column' not found in query"
}
```

### 3. Unsupported Operators

```typescript
try {
    const injector = new SqlParamInjector();
    injector.inject('SELECT price FROM products', { 
        price: { unsupported_op: 'value' } 
    });
} catch (error) {
    console.error(error.message); // "Unsupported operator 'unsupported_op' for state key 'price'"
}
```

## Combining with SqlFormatter

Queries generated by SqlParamInjector can be beautifully formatted using SqlFormatter:

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

const { formattedSql, params } = formatter.format(injectedQuery);
```

## Practical Examples

### E-commerce Product Search

```typescript
import { SqlParamInjector } from 'rawsql-ts';

const searchQuery = `
  SELECT 
    p.product_id,
    p.product_name,
    p.price,
    c.category_name
  FROM products p
  JOIN categories c ON p.category_id = c.category_id
`;

const searchFilters = {
    price: { min: 1000, max: 5000 },
    product_name: { ilike: '%smartphone%' },  // Case-insensitive search
    category_id: { in: [1, 2, 3] },
    in_stock: true,
    created_at: { '>': new Date('2023-01-01') }
};

const injector = new SqlParamInjector();
const searchResult = injector.inject(searchQuery, searchFilters);
```

### User Management System

```typescript
import { SqlParamInjector } from 'rawsql-ts';

const userQuery = `
  SELECT u.user_id, u.username, u.email, u.last_login
  FROM users u
  WHERE u.deleted_at IS NULL
`;

const userFilters = {
    username: { ilike: '%admin%' },  // Case-insensitive search
    last_login: { '>': new Date('2024-01-01') },
    active: true
};

const injector = new SqlParamInjector();
const filteredUsers = injector.inject(userQuery, userFilters);
```

### Advanced Search with OR Conditions

```typescript
import { SqlParamInjector } from 'rawsql-ts';

const customerQuery = `
  SELECT c.customer_id, c.name, c.tel1, c.tel2, c.email
  FROM customers c
`;

// Search customers by phone OR email
const searchFilters = {
    contact_search: {
        or: [
            { column: 'tel1', like: '%080%' },
            { column: 'tel2', like: '%080%' },
            { column: 'email', ilike: '%@gmail.com' }
        ]
    },
    active: true  // Regular AND condition
};

const injector = new SqlParamInjector();
const searchResult = injector.inject(customerQuery, searchFilters);
// Generates: WHERE (tel1 LIKE '%080%' OR tel2 LIKE '%080%' OR email ILIKE '%@gmail.com') AND active = true
```

### Complex Pricing with Explicit Column Mapping

```typescript
import { SqlParamInjector } from 'rawsql-ts';

const productQuery = `
  SELECT p.prd_id, p.prd_name, p.base_price, p.sale_price, p.stock_qty
  FROM products p
`;

// Complex search with column mapping for legacy database
const searchCriteria = {
    product_name: {
        column: 'prd_name',         // Map to legacy column name
        ilike: '%phone%'
    },
    price_conditions: {
        and: [
            { column: 'base_price', min: 100 },
            { column: 'sale_price', max: 1000 },
            { column: 'base_price', '!=': 500 }  // Exclude specific price
        ]
    },
    stock_level: {
        column: 'stock_qty',
        '>': 0
    }
};

const injector = new SqlParamInjector();
const complexSearch = injector.inject(productQuery, searchCriteria);
// Generates complex WHERE clause with proper column mapping and grouping
```

## Important Notes

1. **undefined values**: By default, when all parameters are undefined, an error is thrown to prevent accidental full-table queries. Use `allowAllUndefined: true` to explicitly allow this behavior.
2. **null values**: Explicit null values generate conditions in the format `column = :param`
3. **Column name matching**: By default, case sensitivity and underscores are distinguished
4. **Operator validation**: Using unsupported operators will result in errors
5. **Query parsing**: String queries are automatically parsed using SelectQueryParser
6. **Automatic grouping**: Multiple operators on the same column are automatically wrapped in parentheses
7. **OR/AND conditions**: Explicit `or` and `and` arrays create properly grouped conditions
8. **Column mapping**: Use the `column` property to map parameter names to different database column names

## Performance Considerations and Limitations

- Large numbers of IN clause parameters are expanded as individual parameters
- Complex nested queries may take time for column resolution
- When using physical tables with wildcard selection (e.g., `SELECT *`), column names cannot be determined. Avoid using wildcards or provide a TableColumnResolver.
- Similarly, columns not present in the SQL statement cannot be recognized. Either specify columns explicitly in the SQL or use a resolver to supply them.