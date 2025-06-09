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
        like: '%john%'  // name LIKE '%john%'
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
| `like` | Pattern matching | `name LIKE '%john%'` |
| `in` | IN clause | `id IN (1, 2, 3)` |
| `any` | ANY operator | `tags = ANY([100, 200])` |
| `<` | Less than | `price < 50` |
| `>` | Greater than | `price > 20` |
| `<=` | Less than or equal | `price <= 100` |
| `>=` | Greater than or equal | `price >= 10` |
| `!=` | Not equal | `price != 50` |
| `<>` | Not equal | `price <> 50` |



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


### 2. Custom Table Column Resolver

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

### 3. Complex Condition Example

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
        like: '%premium%'
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
//   a.article_name LIKE :article_name_like AND
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

### 1. Column Not Found

```typescript
try {
    const injector = new SqlParamInjector();
    injector.inject('SELECT name FROM users', { nonexistent_column: 'value' });
} catch (error) {
    console.error(error.message); // "Column 'nonexistent_column' not found in query"
}
```

### 2. Unsupported Operators

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
    product_name: { like: '%smartphone%' },
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
    username: { like: '%admin%' },
    last_login: { '>': new Date('2024-01-01') },
    active: true
};

const injector = new SqlParamInjector();
const filteredUsers = injector.inject(userQuery, userFilters);
```

## Important Notes

1. **undefined values**: undefined values in the state object are ignored and not added to WHERE conditions
2. **null values**: Explicit null values generate conditions in the format `column = :param`
3. **Column name matching**: By default, case sensitivity and underscores are distinguished
4. **Operator validation**: Using unsupported operators will result in errors
5. **Query parsing**: String queries are automatically parsed using SelectQueryParser

## Performance Considerations and Limitations

- Large numbers of IN clause parameters are expanded as individual parameters
- Complex nested queries may take time for column resolution
- When using physical tables with wildcard selection (e.g., `SELECT *`), column names cannot be determined. Avoid using wildcards or provide a TableColumnResolver.
- Similarly, columns not present in the SQL statement cannot be recognized. Either specify columns explicitly in the SQL or use a resolver to supply them.