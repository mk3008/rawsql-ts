# rawsql-ts

![No external dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Browser Support](https://img.shields.io/badge/browser-%F0%9F%9A%80-brightgreen)
![npm version](https://img.shields.io/npm/v/rawsql-ts)
![npm downloads](https://img.shields.io/npm/dm/rawsql-ts)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

🌐 [Online Demo (GitHub Pages)](https://mk3008.github.io/rawsql-ts/)

rawsql-ts is a high-performance SQL parser and AST transformer library written in TypeScript. It is designed for extensibility and advanced SQL analysis, with initial focus on PostgreSQL syntax but not limited to it. The library enables easy SQL parsing, transformation, and analysis for a wide range of SQL dialects.

> [!Note]
> This library is currently in beta. The API may change until the v1.0 release.

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

## Formatter Functionality

The `Formatter` class in rawsql-ts converts a parsed query object (AST) back into a formatted SQL string. This is useful for programmatically manipulating SQL and then generating a string for execution or display.

### Preset Configurations (Formatter.PRESETS)

The `Formatter` class provides preset configurations for common SQL dialects. Use these presets to quickly format queries for MySQL, PostgreSQL, SQL Server, or SQLite without manually specifying options each time.

```typescript
const mysqlSql = formatter.format(query, Formatter.PRESETS.mysql);
const pgSql = formatter.format(query, Formatter.PRESETS.postgres);
const mssqlSql = formatter.format(query, Formatter.PRESETS.sqlserver);
const sqliteSql = formatter.format(query, Formatter.PRESETS.sqlite);
```

**Preset Details:**
- `Formatter.PRESETS.mysql`: Backtick identifier, `?` parameter, no named parameters
- `Formatter.PRESETS.postgres`: Double quote identifier, `:` parameter, named parameters supported
- `Formatter.PRESETS.sqlserver`: Square bracket identifier, `@` parameter, named parameters supported
- `Formatter.PRESETS.sqlite`: Double quote identifier, `:` parameter, named parameters supported

### How to Customize Presets

You can override any preset option as needed. For example, to use variable-style parameters (`${name}`):

```typescript
const variableSql = formatter.format(query, {
  ...Formatter.PRESETS.postgres,
  parameterSymbol: { start: '${', end: '}' },
});
// => select "user_id", "name" from "users" where "active" = ${active}
```

Or to change only the identifier escape style:

```typescript
const customSql = formatter.format(query, {
  ...Formatter.PRESETS.mysql,
  identifierEscape: { start: '"', end: '"' }
});
```

### Configurable Options

Formatting options are provided as the second argument to the `format()` method. You can customize:
- `identifierEscape`: How identifiers are escaped (e.g., `"`, `[`, `` ` ``)
- `parameterSymbol`: The symbol or pattern for parameters (e.g., `:`, `@`, `?`, or `{ start: '${', end: '}' }`)
- `supportNamedParameter`: If false, parameter names are omitted (for MySQL-style `?` only)

### Usage Example

#### Using a Preset

```typescript
import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query, Formatter.PRESETS.postgres);
console.log(formattedSql);
// => select "user_id", "name" from "users" where "active" = true
```

#### Using Manual Configuration

```typescript
import { SelectQueryParser, Formatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();
const formattedSql = formatter.format(query, {
  identifierEscape: { start: '`', end: '`' },
  parameterSymbol: '?',
  supportNamedParameter: false,
});
console.log(formattedSql);
// => select `user_id`, `name` from `users` where `active` = ?
```

rawsql-ts is designed to be flexible and support various SQL dialects. The `Formatter` class can be customized to handle different dialects by adjusting the identifier escape characters, parameter symbols, and named parameter support. This makes it easy to work with SQL queries for different database systems using a consistent API.

---

## Main Parser Features

- All parsers automatically remove SQL comments before parsing.
- Detailed error messages are provided for all parsing errors.
- Highly accurate and advanced tokenization is used for robust SQL analysis.

> [!Note]
> All parsers in rawsql-ts have been tested with PostgreSQL syntax, but they are capable of parsing any generic SQL statement that does not use a DBMS-specific dialect.

- **SelectQueryParser**  
  The main class for converting SELECT and VALUES statements into AST. Fully supports CTEs (WITH), UNION/INTERSECT/EXCEPT, subqueries, and PostgreSQL-style syntax.
  - `parse(sql: string): SelectQuery`  
    Converts a SQL string to an AST. Throws an exception on error.
  - In this library, a "select query" is represented as one of the following types:
    - `SimpleSelectQuery`: A standard SELECT statement with all major clauses (WHERE, GROUP BY, JOIN, etc.)
    - `BinarySelectQuery`: A set operation query such as UNION, INTERSECT, or EXCEPT
    - `ValuesQuery`: An inline VALUES table (e.g., `VALUES (1, 'a'), (2, 'b')`)

- **InsertQueryParser**  
  The main class for parsing `INSERT INTO` statements and converting them into AST. Supports PostgreSQL-style INSERT with or without column lists, as well as `INSERT ... SELECT` and `INSERT ... VALUES` forms.
  - `parse(sql: string): InsertQuery`  
    Converts an INSERT SQL string to an AST. Throws an exception on error.

---

## Core SQL Query Classes

- **SimpleSelectQuery**  
  Represents a standard SELECT statement. Supports all major clauses such as WHERE, GROUP BY, JOIN, and CTE.
  - `toUnion`, `toUnionAll`, ... for UNION operations
  - `appendWhere`, `appendWhereRaw` to add WHERE conditions
  - `appendWhereExpr` to add a WHERE condition using the column's SQL expression (see below)
  - `overrideSelectItemExpr` to override a SELECT item using its SQL expression (see below)
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

## Advanced Expression-based Methods

### appendWhereExpr
`appendWhereExpr` is a highly important feature that enables you to add WHERE conditions using the SQL expression of a column, regardless of whether it is a direct column, an alias, a table alias, or even a calculated expression.

- **Basic Column**
  - SQL: `select amount from sales`
  - API: `query.appendWhereExpr('amount', expr => `${expr} > 100`)`
  - Result: `where amount > 100`

- **Alias**
  - SQL: `select fee as amount from sales`
  - API: `query.appendWhereExpr('amount', expr => `${expr} > 100`)`
  - Result: `where fee > 100`

- **Table Alias**
  - SQL: `select s.fee as amount from sales as s`
  - API: `query.appendWhereExpr('amount', expr => `${expr} > 100`)`
  - Result: `where s.fee > 100`

- **Expression**
  - SQL: `select quantity * pack_size as amount from sales`
  - API: `query.appendWhereExpr('amount', expr => `${expr} > 100`)`
  - Result: `where quantity * pack_size > 100`

As long as the column is named (or aliased) as `amount`, `appendWhereExpr` will detect and use the correct SQL expression for the WHERE clause—even if it is a complex calculation or uses table aliases.

```typescript
// Works for any alias, table alias, or expression!
query.appendWhereExpr('amount', expr => `${expr} > 100`);
```

#### Upstream Query Support

`Upstream Query Support` is a powerful extension of `appendWhereExpr` that allows you to add WHERE conditions to all relevant upstream queries that provide a specific column, regardless of the query structure. This means you can target columns defined in subqueries, CTEs (WITH clauses), or even branches of UNION/INTERSECT/EXCEPT, and the condition will be automatically inserted at the correct place in the SQL tree.

**What does this mean in practice?**
- If the column is defined in a subquery, the WHERE condition is added inside that subquery.
- If the column is defined in a CTE (WITH clause), the WHERE condition is added inside the CTE.
- If the column is provided by multiple upstream queries (e.g., UNION branches), the condition is added to all relevant branches.
- You do not need to know or traverse the query structure yourself—just specify the column name, and `appendWhereExpr` with `{ upstream: true }` will do the rest.

##### Example: Filtering a CTE

```typescript
const query = SelectQueryParser.parse(`
  WITH temp_sales AS (
    SELECT id, amount, date FROM sales WHERE date >= '2024-01-01'
  )
  SELECT * FROM temp_sales
`) as SimpleSelectQuery;

// Add a filter to the CTE using upstream support
query.appendWhereExpr('amount', expr => `${expr} > 100`, { upstream: true });

const sql = new Formatter().format(query);
console.log(sql);
// => with "temp_sales" as (select "id", "amount", "date" from "sales" where "date" >= '2024-01-01' and "amount" > 100) select * from "temp_sales"
```

##### Example: Filtering All Branches of a UNION

```typescript
const query = SelectQueryParser.parse(`
  WITH sales_transactions AS (
    SELECT transaction_id, customer_id, amount, transaction_date FROM sales_schema.transactions WHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days'
  ),
  support_transactions AS (
    SELECT support_id AS transaction_id, user_id AS customer_id, fee AS amount, support_date AS transaction_date FROM support_schema.support_fees WHERE support_date >= CURRENT_DATE - INTERVAL '90 days'
  )
  SELECT * FROM (
    SELECT * FROM sales_transactions
    UNION ALL
    SELECT * FROM support_transactions
  ) d
  ORDER BY transaction_date DESC
`) as SimpleSelectQuery;

// Add a filter to all upstream queries that provide 'amount'
query.appendWhereExpr('amount', expr => `${expr} > 100`, { upstream: true });

const sql = new Formatter().format(query);
console.log(sql);
// => with "sales_transactions" as (select ... where ... and "amount" > 100),
//        "support_transactions" as (select ... where ... and "fee" > 100)
//    select * from (... union all ...) as "d" order by "transaction_date" desc
```

### appendWhereExpr Use Cases

`appendWhereExpr` is especially useful in the following scenarios:

- **Dynamic Search Conditions for Complex Reports**  
  Easily inject arbitrary search filters into deeply nested or highly complex queries, such as those used in reporting or analytics dashboards. This enables flexible, user-driven filtering without manual SQL string manipulation.

- **Performance-Critical Query Construction**  
  Build high-performance queries by programmatically adding WHERE conditions only when needed, ensuring that unnecessary filters are not included and that the generated SQL remains as efficient as possible.

- **Generic Access Control and Security Filters**  
  Apply reusable access control or security-related WHERE clauses (e.g., tenant isolation, user-based restrictions) across all relevant queries, regardless of their internal structure. This helps enforce consistent data access policies throughout your application.

> [!TIP] 
> Upstream Query Support is especially useful for large, complex SQL with multiple layers of subqueries, CTEs, or set operations. You can add filters or conditions without worrying about the internal structure—just specify the column name!
>
> You can focus on developing and maintaining RawSQL itself, without being bothered by troublesome variable search conditions.

---

### overrideSelectItemExpr
Overrides a SELECT item using its SQL expression. The callback receives the original SQL expression as a string and returns a new SQL string.

```typescript
// Override the SELECT item 'journal_date' to use greatest(journal_date, DATE '2025-01-01')
query.overrideSelectItemExpr('journal_date', expr => `greatest(${expr}, DATE '2025-01-01')`);
```
---



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
- **QueryConverter**  
  Converts any SELECT/UNION/VALUES query into a standard SimpleSelectQuery. Handles subquery wrapping and automatic column name generation.
  Supports CREATE TABLE ... AS SELECT ... conversion:
  - `QueryConverter.toCreateTableQuery(query, tableName, isTemporary?)` creates a `CreateTableQuery` from any SELECT query.

- **TableColumnResolver**  
  A function type for resolving column names from a table name, mainly used for wildcard expansion (e.g., `table.*`). Used by analyzers like SelectValueCollector.
  ```typescript
  export type TableColumnResolver = (tableName: string) => string[];
  ```

---

## Usage Example

```typescript
import { TableColumnResolver, SelectQueryParser, SelectableColumnCollector, SelectValueCollector, TableSourceCollector, Formatter } from 'rawsql-ts';

// TableColumnResolver example
const resolver: TableColumnResolver = (tableName) => {
    if (tableName === 'users') return ['user_id', 'user_name', 'email'];
    if (tableName === 'posts') return ['post_id', 'user_id', 'title', 'content'];
    return [];
};

const sql = `SELECT u.*, p.title as post_title FROM users u INNER JOIN posts p ON u.user_id = p.user_id`;
const query = SelectQueryParser.parse(sql);
const formatter = new Formatter();

// Collects information from the SELECT clause.
// To expand wildcards, you must specify a TableColumnResolver.
const selectValueCollector = new SelectValueCollector(resolver);
const selectValues = selectValueCollector.collect(query);
// Log the name and formatted value of each select value
console.log('Select values:');
selectValues.forEach(val => {
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value)}`);
});
/*
Select values:
  name: post_title, value: "p"."title"
  name: user_id, value: "u"."user_id"
  name: user_name, value: "u"."user_name"
  name: email, value: "u"."email"
*/
```

```typescript
// Collects selectable columns from the FROM/JOIN clauses.
// You can get accurate information by specifying a TableColumnResolver.
// If omitted, the information will be inferred from the query content.
const selectableColumnCollector = new SelectableColumnCollector(resolver);
const selectableColumns = selectableColumnCollector.collect(query);
// Log detailed info for each selectable column
console.log('Selectable columns:');
selectableColumns.forEach(val => {
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value)}`);
});
/*
Selectable columns:
  name: post_title, value: "p"."title"
  name: user_id, value: "u"."user_id"
  name: user_name, value: "u"."user_name"
  name: email, value: "u"."email"
  name: post_id, value: "p"."post_id"
  name: title, value: "p"."title"
  name: content, value: "p"."content"
*/
```

```typescript
// Create Table from SELECT Example
import { QueryConverter, SelectQueryParser, Formatter } from 'rawsql-ts';

const select = SelectQueryParser.parse('SELECT id, name FROM users');
const create = QueryConverter.toCreateTableQuery(select, 'my_table');
const sqlCreate = new Formatter().format(create);
console.log(sqlCreate);
// => create table "my_table" as select "id", "name" from "users"

const createTemp = QueryConverter.toCreateTableQuery(select, 'tmp_table', true);
const sqlTemp = new Formatter().format(createTemp);
console.log(sqlTemp);
// => create temporary table "tmp_table" as select "id", "name" from "users"
```

```typescript
// Retrieves physical table sources.
const tableSourceCollector = new TableSourceCollector();
const sources = tableSourceCollector.collect(query);
// Log detailed info for each source
console.log('Sources:');
sources.forEach(src => {
    console.log(`  name: ${src.getSourceName()}`);
});
/*
TableSources:
  name: users
  name: posts
*/
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

