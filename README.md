# rawsql-ts

![No external dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Browser Support](https://img.shields.io/badge/browser-%F0%9F%9A%80-brightgreen)
![npm version](https://img.shields.io/npm/v/rawsql-ts)
![npm downloads](https://img.shields.io/npm/dm/rawsql-ts)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

rawsql-ts is a high-performance SQL parser and AST transformer library written in TypeScript. It is designed for extensibility and advanced SQL analysis, with initial focus on PostgreSQL syntax but not limited to it. The library enables easy SQL parsing, transformation, and analysis for a wide range of SQL dialects.

> **Note:** This library is currently in beta. The API may change until the v1.0 release.

---

💡 **Key Advantages**

With rawsql-ts, raw SQL can be represented as objects, enabling flexible manipulation of SQL statements directly within your program. Objectified SQL can be partially transformed, decomposed into manageable components, and recombined as needed. This approach dramatically improves the maintainability and reusability of complex SQL, making even large-scale queries easy to manage and refactor.

---

## Features

- Zero dependencies: fully self-contained and lightweight
- High-speed SQL parsing and AST analysis
- Rich utilities for SQL structure transformation and analysis

## ✨ Browser & CDN Ready!

You can use rawsql-ts directly in modern browsers via CDN (unpkg/jsdelivr)!
No Node.js dependencies, no build tools required.
Just import it like this:

```html
<!-- Always get the latest version -->
<script type="module">
  import { parse } from "https://unpkg.com/rawsql-ts/dist/esm/index.js";
</script>
```

```html
<!-- Pin a specific version for stability -->
<script type="module">
  import { parse } from "https://unpkg.com/rawsql-ts@0.1.0-beta.12/dist/esm/index.js";
</script>
```

---

## Installation

```bash
npm install rawsql-ts
```

## Quick Start

```typescript
import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);
// => select "user_id", "name" from "users" where "active" = true
```

---

## Main Parser Features

- **SelectQueryParser**  
  The main class for converting SELECT and VALUES statements into AST. Fully supports CTEs (WITH), UNION/INTERSECT/EXCEPT, subqueries, and PostgreSQL-specific syntax.
  - `parse(sql: string): SelectQuery`  
    Converts a SQL string to an AST. Throws an exception on error.
  - Supports only PostgreSQL syntax
  - Only SELECT and VALUES are supported (INSERT/UPDATE/DELETE are not yet implemented)
  - SQL comments are automatically removed
  - Handles CTEs (WITH), UNION/INTERSECT/EXCEPT, subqueries, window functions, complex expressions, and functions
  - Provides detailed error messages
  - Highly accurate tokenization

---

## Core SQL Query Classes

- **SimpleSelectQuery**  
  Represents a standard SELECT statement. Supports all major clauses such as WHERE, GROUP BY, JOIN, and CTE.
  - `toUnion`, `toUnionAll`, ... for UNION operations
  - `appendWhere`, `appendWhereRaw` to add WHERE conditions
  - `innerJoin`, `leftJoin`, ... to add JOINs
  - `toSource` to wrap as a subquery
  - `appendWith`, `appendWithRaw` to add CTEs

- **BinarySelectQuery**  
  Represents binary SQL queries such as UNION, INTERSECT, and EXCEPT.
  - `union`, `intersect`, ... to combine queries
  - `toSource` to wrap as a subquery
  - `unionRaw`, ... to combine with raw SQL

- **ValuesQuery**  
  For inline tables like `VALUES (1, 'a'), (2, 'b')`.
  - Can be used as a subquery or converted to SELECT with QueryNormalizer

---

## AST Transformer Features

A suite of utilities for transforming and analyzing SQL ASTs.

### Main Transformers

- **Formatter**  
  Converts ASTs to formatted SQL strings. Handles identifier escaping. Output is currently single-line (compact) style.
- **SelectValueCollector**  
  Extracts all columns, aliases, and expressions from SELECT clauses. Supports wildcard expansion (e.g., `*`, `table.*`) with TableColumnResolver.
- **SelectableColumnCollector**  
  Collects all columns available from root FROM/JOIN sources.
- **TableSourceCollector**  
  Collects all table and subquery sources from FROM and JOIN clauses.
- **CTECollector**  
  Collects all CTEs from WITH clauses, subqueries, and UNION queries.
- **UpstreamSelectQueryFinder**  
  Finds upstream SELECT queries that provide specific columns by traversing CTEs, subqueries, and UNION branches.
- **CTENormalizer**  
  Consolidates all CTEs into a single root-level WITH clause. Throws an error if duplicate CTE names with different definitions are found.
- **QueryNormalizer**  
  Converts any SELECT/UNION/VALUES query into a standard SimpleSelectQuery. Handles subquery wrapping and automatic column name generation.
- **TableColumnResolver**  
  A function type for resolving column names from a table name, mainly used for wildcard expansion (e.g., `table.*`). Used by analyzers like SelectValueCollector.
  ```typescript
  export type TableColumnResolver = (tableName: string) => string[];
  ```

---

## Usage Example

```typescript
import { TableColumnResolver } from "./src/transformers/TableColumnResolver";
import { SelectQueryParser } from 'rawsql-ts';
import { SelectableColumnCollector } from 'rawsql-ts/transformers/SelectableColumnCollector';
import { SelectValueCollector } from 'rawsql-ts/transformers/SelectValueCollector';
import { TableSourceCollector } from 'rawsql-ts/transformers/TableSourceCollector';

// TableColumnResolver example
const resolver: TableColumnResolver = (tableName) => {
  if (tableName === "users") return ["id", "name", "email"];
  if (tableName === "posts") return ["id", "title", "content"];
  return [];
};

const sql = `SELECT u.* FROM users u JOIN posts p ON u.id = p.user_id`;
const query = SelectQueryParser.parse(sql);

// Wildcard expansion example
const selectValueCollector = new SelectValueCollector(resolver);
const selectValues = selectValueCollector.collect(query);
console.log(selectValues.map(val => val.alias || val.expression.toString()));

// Collect all selectable columns from FROM/JOIN sources
const selectableColumnCollector = new SelectableColumnCollector();
const selectableColumns = selectableColumnCollector.collect(query);
console.log(selectableColumns.map(col => col.name));

// Collect all table and subquery sources from FROM/JOIN clauses
const tableSourceCollector = new TableSourceCollector();
const sources = tableSourceCollector.collect(query);
console.log(sources.map(src => src.alias || src.name));
```

---

## Advanced Example: Table Join

This example demonstrates how to join two tables using rawsql-ts. You do not need to understand the internal structure or manage aliases manually. By specifying the join key(s), the ON clause is generated automatically.

```typescript
import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query
const query = SelectQueryParser.parse('SELECT u.user_id, u.name FROM users u') as SimpleSelectQuery;

// Add LEFT JOIN using the leftJoinRaw method (join on user_id)
query.leftJoinRaw('orders', 'o', ['user_id']);

// Add WHERE clause
query.appendWhereRaw('o.order_id IS NULL');

const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);
// => select "u"."user_id", "u"."name" from "users" as "u" left join "orders" as "o" on "u"."user_id" = "o"."user_id" where "o"."order_id" is null
```

**Key Points:**
- No need to understand internal implementation or alias management
- Specify only the join key(s) (e.g., `['user_id']`); the ON clause is generated automatically
- Subqueries and aliases are handled automatically
- You can join queries without detailed knowledge of SQL structure or AST internals

---

## Benchmarks

This project includes a comprehensive benchmark suite to evaluate the performance of `rawsql-ts` in comparison with other popular libraries such as `node-sql-parser` and `sql-formatter`.

### How to Run

```bash
npm run benchmark
```

### Benchmark Details

The benchmark suite measures SQL parsing and formatting speed across queries of varying complexity:

- **Tokens20**: Simple SELECT with a basic WHERE clause (~20 tokens)
- **Tokens70**: Medium complexity query with JOINs and multiple conditions (~70 tokens)
- **Tokens140**: Complex query with CTEs and aggregations (~140 tokens)
- **Tokens230**: Highly complex query with multiple CTEs, subqueries, and window functions (~230 tokens)

### Benchmark Environment

```
benchmark.js v2.1.4  
Windows 10.0.26100  
AMD Ryzen 7 7800X3D (8C/16T)  
Node.js v22.14.0
```

### Results

#### Tokens20
| Method           | Mean      | Error     | StdDev    |
|------------------|----------:|----------:|----------:|
| rawsql-ts        | 0.021 ms  | 0.0044 ms | 0.0023 ms |
| node-sql-parser  | 0.169 ms  | 0.0695 ms | 0.0355 ms |
| sql-formatter    | 0.208 ms  | 0.0556 ms | 0.0284 ms |

#### Tokens70
| Method           | Mean      | Error     | StdDev    |
|------------------|----------:|----------:|----------:|
| rawsql-ts        | 0.057 ms  | 0.0143 ms | 0.0073 ms |
| node-sql-parser  | 0.216 ms  | 0.0780 ms | 0.0398 ms |
| sql-formatter    | 0.512 ms  | 0.1251 ms | 0.0638 ms |

#### Tokens140
| Method           | Mean      | Error     | StdDev    |
|------------------|----------:|----------:|----------:|
| rawsql-ts        | 0.112 ms  | 0.0236 ms | 0.0120 ms |
| node-sql-parser  | 0.404 ms  | 0.0926 ms | 0.0472 ms |
| sql-formatter    | 1.004 ms  | 0.3027 ms | 0.1545 ms |

#### Tokens230
| Method           | Mean      | Error     | StdDev    |
|------------------|----------:|----------:|----------:|
| rawsql-ts        | 0.182 ms  | 0.0371 ms | 0.0189 ms |
| node-sql-parser  | 0.865 ms  | 0.3325 ms | 0.1696 ms |
| sql-formatter    | 1.696 ms  | 0.2754 ms | 0.1405 ms |

### Performance Summary

- `rawsql-ts` consistently outperforms both `node-sql-parser` and `sql-formatter` in all tested scenarios.
- Approximately 4x faster than `node-sql-parser`.
- Approximately 9–10x faster than `sql-formatter`.
- Maintains high performance even with complex SQL while providing comprehensive features.

> **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and query complexity.

---

Feel free to try rawsql-ts! Questions, requests, and bug reports are always welcome.

