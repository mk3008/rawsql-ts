# rawsql-ts

A TypeScript SQL parser project that performs AST (Abstract Syntax Tree) analysis.

## Installation

Install the main project:

```bash
npm install
```

## Usage

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## ✅ Supported Features

**Main features included in this parser:**

- **CTE Support**: Full Common Table Expression parsing
  - PostgreSQL `MATERIALIZED`/`NOT MATERIALIZED` options
  - Nested and recursive CTEs
- **UNION Queries**: Handles UNION, UNION ALL, INTERSECT and EXCEPT
- **Complex Subqueries**: Supports subqueries and inline queries
- **Window Functions**: Complete WINDOW clause and function support
- **PostgreSQL Optimized**: Deep support for PostgreSQL syntax
  - `DISTINCT ON (columns)` expressions
  - Array and range operators

## ⚠️ Important Notes

**Under development with the following limitations:**

- **PostgreSQL Only**: Only PostgreSQL syntax is currently supported
- **Comments Stripped**: SQL comments are removed during parsing
- **SELECT Queries Only**: Currently only handles SELECT queries (no INSERT/UPDATE/DELETE)
- **One-line Formatting**: Currently only supports single-line (compact) output formatting
- **Beta Status**: API may change without notice until v1.0 release

## Visitor Pattern Utilities

rawsql-ts includes powerful visitor pattern utilities to analyze and transform SQL ASTs:

### Formatter

The Formatter transforms SQL ASTs into clean, standardized SQL text output. It handles all SQL components, ensuring proper escaping and consistent formatting regardless of the complexity of your queries.

```typescript
import { SelectQueryParser } from './parsers/SelectQueryParser';
import { Formatter } from './transformers/Formatter';

// Example complex query with subquery and functions
const sql = `
SELECT
    p.product_id
    , p.name
    , SUM(o.quantity) AS total_ordered
    , CASE
        WHEN SUM(o.quantity) > 1000 THEN 'High Demand'
        WHEN SUM(o.quantity) > 500 THEN 'Medium Demand'
        ELSE 'Low Demand'
    END AS demand_category
FROM
    products AS p
    JOIN order_items AS o ON p.product_id = o.product_id
WHERE
    p.category IN (
        SELECT
            category
        FROM
            featured_categories
        WHERE
            active = TRUE
    )
GROUP BY
    p.product_id
    , p.name
HAVING
    SUM(o.quantity) > 100
ORDER BY
    total_ordered DESC`;

// Parse the query into an AST
const query = SelectQueryParser.parseFromText(sql);

// Format the AST back to SQL
const formatter = new Formatter();
const formattedSql = formatter.visit(query);

console.log(formattedSql);
// Outputs clean, consistently formatted SQL with proper identifiers
```

### SelectValueCollector

The SelectValueCollector extracts all column items from a SELECT clause, including their aliases and expressions. It provides access to both column names and their corresponding value expressions, making it perfect for analyzing the output structure of SQL queries. For information on wildcard resolution (like `*` or `table.*`), see the Wildcard Resolution section below.

```typescript
import { SelectQueryParser } from './parsers/SelectQueryParser';
import { SelectValueCollector } from './transformers/SelectValueCollector';
import { Formatter } from './transformers/Formatter';

// Example query with column references and expressions
const sql = `
SELECT
    id
    , name
    , price * quantity AS total
    , (
        SELECT
            COUNT(*)
        FROM
            orders AS o
        WHERE
            o.customer_id = c.id
    ) AS order_count
FROM
    customers AS c
WHERE
    status = 'active'`;

const query = SelectQueryParser.parseFromText(sql);

// Collect all select values
const collector = new SelectValueCollector();
const items = collector.collect(query);

// Format expressions for display
const formatter = new Formatter();

// Output column names
console.log(items.map(item => item.name));
// ["id", "name", "total", "order_count"]

// Output column expressions to show full value components
console.log(items.map(item => formatter.visit(item.value)));
// ["id", "name", "price * quantity", "(SELECT COUNT(*) FROM orders AS o WHERE o.customer_id = c.id)"]
```

### SelectableColumnCollector

The SelectableColumnCollector identifies all column references throughout a query that could potentially be included in a SELECT clause. It scans the entire query structure and extracts columns with their full context, making it ideal for query builders. For information on wildcard resolution (like `*` or `table.*`), see the Wildcard Resolution section below.

```typescript
import { SelectQueryParser } from './parsers/SelectQueryParser';
import { SelectableColumnCollector } from './transformers/SelectableColumnCollector';
import { Formatter } from './transformers/Formatter';

// Example query
const sql = `
SELECT
    u.id
    , u.name
FROM
    users AS u
    JOIN profiles AS p ON u.id = p.user_id
WHERE
    u.active = TRUE
    AND p.verified = TRUE`;

const query = SelectQueryParser.parseFromText(sql);
const collector = new SelectableColumnCollector();

// Collect all column references from data sources
collector.visit(query);
const columns = collector.collect(query);

// Format column references for display
const formatter = new Formatter();
const columnNames = columns.map(item => item.name);
console.log(columnNames);
// ["id", "name", "active", "user_id", "verified"]

// Get the original column expressions with their full context
const expressions = columns.map(item => formatter.visit(item.value));
console.log(expressions);
// ["u.id", "u.name", "u.active", "p.user_id", "p.verified"]
```

### Wildcard Resolution

The wildcard resolution feature enhances both collectors by supporting the expansion of wildcard expressions (`*` and `table.*`). Since SQL AST analysis alone cannot determine actual column names from wildcards, this feature allows you to provide table structure information through a custom resolver.

To use this feature, simply provide a `TableColumnResolver` function when creating a collector. This resolver maps table names to their column definitions, allowing the collectors to fully expand wildcard expressions into individual columns with proper context.

```typescript
import { SelectQueryParser } from './parsers/SelectQueryParser';
import { SelectValueCollector } from './transformers/SelectValueCollector';
import { Formatter } from './transformers/Formatter';

// Define a function to resolve column names from table names
const tableColumnResolver = (tableName: string): string[] => {
  // In real applications, this would fetch from database metadata or schema information
  const tableColumns: Record<string, string[]> = {
    'users': ['id', 'name', 'email', 'created_at'],
    'posts': ['id', 'title', 'content', 'user_id', 'created_at'],
    'comments': ['id', 'post_id', 'user_id', 'content', 'created_at']
  };
  
  return tableColumns[tableName] || [];
};

// Query containing wildcards
const sql = `
SELECT
    u.*
    , p.title
    , p.content
FROM
    users AS u
    JOIN posts AS p ON u.id = p.user_id
WHERE
    u.created_at > '2023-01-01'`;

const query = SelectQueryParser.parseFromText(sql);

// Pass the TableColumnResolver to resolve wildcards
const collector = new SelectValueCollector(tableColumnResolver);
const items = collector.collect(query);

// Display results
const formatter = new Formatter();
console.log(items.map(item => item.name));
// ["id", "name", "email", "created_at", "title", "content"]

// Show full reference expressions for each column
console.log(items.map(item => formatter.visit(item.value)));
// ["u.id", "u.name", "u.email", "u.created_at", "p.title", "p.content"]
```

This capability allows you to parse queries containing wildcards and understand exactly which columns are being referenced. It also supports expansion of wildcards from multiple tables and subqueries.

## Benchmarks

This project includes benchmarking functionality.
To run benchmarks:

```bash
npm run benchmark
```

## Benchmark Details

This benchmark evaluates the SQL parsing and formatting performance of `rawsql-ts` against popular libraries: `sql-formatter` and `node-sql-parser`. We test queries of varying complexity:

- **Tokens20**: Simple `SELECT` query with a basic `WHERE` condition (~20 tokens)
- **Tokens70**: Medium complexity query with `JOIN`s and multiple conditions (~70 tokens)
- **Tokens140**: Complex query with `CTE`s and aggregations (~140 tokens)
- **Tokens230**: Very complex query with multiple `CTE`s, subqueries, and window functions (~230 tokens)

## Benchmark Environment

```
benchmark.js v2.1.4  
Windows 10.0.26100  
AMD Ryzen 7 7800X3D (8C/16T)  
Node.js v22.14.0
```

## Results

### Tokens20
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| rawsql-ts                  |    0.021 ms |  0.0044 ms |  0.0023 ms |
| node-sql-parser                |    0.169 ms |  0.0695 ms |  0.0355 ms |
| sql-formatter                  |    0.208 ms |  0.0556 ms |  0.0284 ms |

### Tokens70
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| rawsql-ts                  |    0.057 ms |  0.0143 ms |  0.0073 ms |
| node-sql-parser                |    0.216 ms |  0.0780 ms |  0.0398 ms |
| sql-formatter                  |    0.512 ms |  0.1251 ms |  0.0638 ms |

### Tokens140
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| rawsql-ts                  |    0.112 ms |  0.0236 ms |  0.0120 ms |
| node-sql-parser                |    0.404 ms |  0.0926 ms |  0.0472 ms |
| sql-formatter                  |    1.004 ms |  0.3027 ms |  0.1545 ms |

### Tokens230
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| rawsql-ts                  |    0.182 ms |  0.0371 ms |  0.0189 ms |
| node-sql-parser                |    0.865 ms |  0.3325 ms |  0.1696 ms |
| sql-formatter                  |    1.696 ms |  0.2754 ms |  0.1405 ms |

## Performance Summary

- `rawsql-ts` **consistently outperforms** both `node-sql-parser` and `sql-formatter` in all tested cases.
- **4x faster** than `node-sql-parser`.
- **9-10x faster** than `sql-formatter`.
- Maintains **full SQL parsing capabilities** while significantly improving performance.

> ⚠️ **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and workload.
