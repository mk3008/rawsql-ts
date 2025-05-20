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
- High-speed SQL parsing and AST analysis (over 3x faster than major libraries)
- Rich utilities for SQL structure transformation and analysis
- Advanced SQL formatting capabilities, including multi-line formatting and customizable styles

![Benchmark Results](https://quickchart.io/chart?c={type:'bar',data:{labels:['Tokens20','Tokens70','Tokens140','Tokens230'],datasets:[{label:'rawsql-ts',data:[0.029,0.075,0.137,0.239],backgroundColor:'rgba(54,162,235,0.8)',borderColor:'rgba(54,162,235,1)',borderWidth:1},{label:'node-sql-parser',data:[0.210,0.223,0.420,0.871],backgroundColor:'rgba(255,206,86,0.8)',borderColor:'rgba(255,206,86,1)',borderWidth:1},{label:'sql-formatter',data:[0.228,0.547,1.057,1.906],backgroundColor:'rgba(255,99,132,0.8)',borderColor:'rgba(255,99,132,1)',borderWidth:1}]},options:{plugins:{legend:{labels:{color:'black'}}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}})

> [!Note]
> The "Mean" column represents the average time taken to process a query. Lower values indicate faster performance. For more details, see the [Benchmark](#benchmarks).

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
import { SelectQueryParser, SqlFormatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter();
const { formattedSql } = formatter.format(query);

console.log(formattedSql);
// => select "user_id", "name" from "users" where "active" = true
```

---

## Formatter Functionality

The `SqlFormatter` class in rawsql-ts is the recommended way to format SQL queries. It provides advanced SQL formatting capabilities, including support for indentation, keyword casing, and line breaks, making it ideal for generating human-readable SQL. 

> [!Note]
> While the older `Formatter` class is still available for backward compatibility, `SqlFormatter` offers enhanced functionality and is the preferred choice for new projects. `SqlFormatter` is available starting from version 0.7.

### Key Features of SqlFormatter

- **Indentation and Keyword Casing**: Supports customizable indentation and keyword casing (e.g., UPPERCASE, lowercase).
- **Preset Configurations**: Includes presets for common SQL dialects (MySQL, PostgreSQL, SQL Server, SQLite) to simplify configuration.
- **Customizable Options**: Allows fine-grained control over formatting styles, such as comma placement, parameter styles, and newline characters.
- **Parameterized Query Formatting**: Supports anonymous (`?`), indexed (`$1`, `$2`), and named (`:name`, `@name`) parameter styles for compatibility with various database systems.

### Preset Configurations (SqlFormatter.PRESETS)

The `SqlFormatter` class provides preset configurations for common SQL dialects. Use these presets to quickly format queries without manually specifying options each time.

```typescript
const formatter = new SqlFormatter({ preset: 'mysql' });
const { formattedSql } = formatter.format(query);
console.log(formattedSql);
```

**Preset Details:**
- `mysql`: Backtick identifier, `?` parameter, no named parameters
- `postgres`: Double quote identifier, `$` parameter, indexed parameters
- `sqlserver`: Square bracket identifier, `@` parameter, named parameters
- `sqlite`: Double quote identifier, `:` parameter, named parameters

### Customizing SqlFormatter

You can override any preset option as needed. For example, to use variable-style parameters (`${name}`):

```typescript
const formatter = new SqlFormatter({
  preset: 'postgres',
  parameterSymbol: { start: '${', end: '}' },
});
const { formattedSql } = formatter.format(query);
console.log(formattedSql);
// => select "user_id", "name" from "users" where "active" = ${active}
```

### Configurable Options

SqlFormatter supports a wide range of options to customize the output:

- `identifierEscape`: How identifiers are escaped (e.g., `"`, `[`, `` ` ``).
- `parameterSymbol`: The symbol or pattern for parameters (e.g., `:`, `@`, `?`, or `{ start: '${', end: '}' }`).
- `parameterStyle`: Controls the parameter style (anonymous, indexed, or named).
- `indentSize`: Number of spaces or tabs for indentation.
- `keywordCase`: Casing for SQL keywords (`upper`, `lower`, or `none`).
- `commaBreak`: Placement of commas (`before` or `after`).
- `andBreak`: Placement of `AND`/`OR` in conditions (`before` or `after`).
- `newline`: Specifies the newline character used in the output (e.g., `\n`, `\r\n`, or a single space for compact formatting).

### Parameterized Query Formatting

`SqlFormatter` supports advanced parameterized query formatting for all major SQL dialects. You can output SQL with parameters in three styles:

- **Anonymous** (`?`): For MySQL and similar drivers. Parameters are output as `?` and values are provided as an array.
- **Indexed** (`$1`, `$2`, ...): For PostgreSQL and compatible drivers. Parameters are output as `$1`, `$2`, ... and values are provided as an array in the correct order.
- **Named** (`:name`, `@name`): For SQL Server, SQLite, and ORMs. Parameters are output as `:name` or `@name` and values are provided as an object.

The `parameterStyle` option in `SqlFormatter` allows you to control the parameter style, or you can use built-in presets (e.g., `mysql`, `postgres`, `sqlserver`, `sqlite`) to apply the correct style automatically.

### Usage Example

#### Using a Preset

```typescript
import { SqlFormatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter({ preset: 'postgres' });
const { formattedSql } = formatter.format(query);
console.log(formattedSql);
/*
select "user_id", "name" from "users" where "active" = true
*/
```

#### Using Custom Configuration

```typescript
import { SqlFormatter } from 'rawsql-ts';

const sql = `SELECT user_id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter({
  identifierEscape: { start: '`', end: '`' },
  parameterSymbol: '?',
  parameterStyle: 'anonymous',
  indentSize: 2,
  keywordCase: 'upper',
  newline: '\r\n',
  commaBreak: 'before', // Specify the "before comma" option
});
const { formattedSql } = formatter.format(query);
console.log(formattedSql);
/*
SELECT
  `user_id`
  , `name`
FROM
  `users`
WHERE
  `active` = ?
*/
```

#### Parameterized Query Output

```typescript
import { SelectQueryParser, SqlFormatter } from 'rawsql-ts';

const sql = 'SELECT * FROM users WHERE id = :id AND status = :status';
const query = SelectQueryParser.parse(sql);
query.setParameter('id', 123);
query.setParameter('status', 'active');

const formatter = new SqlFormatter({ parameterStyle: 'named' });
const { formattedSql, params } = formatter.format(query);

console.log(formattedSql);
// => select * from "users" where "id" = :id and "status" = :status
console.log(params);
// => { id: 123, status: 'active' }
```

For anonymous or indexed styles, simply change the `parameterStyle` option:

```typescript
const formatter = new SqlFormatter({ parameterStyle: 'anonymous' });
// formattedSql: 'select * from "users" where "id" = ? and "status" = ?'
// params: [123, 'active']

const formatterIndexed = new SqlFormatter({ parameterStyle: 'indexed' });
// formattedSql: 'select * from "users" where "id" = $1 and "status" = $2'
// params: [123, 'active']
```

`SqlFormatter` ensures parameter indexes are assigned correctly, even for complex queries with CTEs, subqueries, or set operations. This makes it easy to build safe, maintainable, and portable SQL in TypeScript.

> [!Tip]
> Use named parameters in your source code for better readability and maintainability. You can always output the final SQL and parameters in the style required by your database client (e.g., anonymous or indexed) at formatting time.

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

- **UpdateQueryParser**  
  The main class for parsing `UPDATE` statements and converting them into AST. Supports PostgreSQL-style UPDATE with optional CTE (WITH clause), table alias, SET, WHERE, FROM, and RETURNING clauses.
  - `parse(sql: string): UpdateQuery`  
    Converts an UPDATE SQL string to an AST. Throws an exception on error.

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

const sql = new SqlFormatter().format(query).formattedSql;
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

const sql = new SqlFormatter().format(query).formattedSql;
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

## JSON Generation with JSONFormatter

The `JSONFormatter` transformer allows you to convert a SQL query's results into a JSON array format using PostgreSQL's JSON functions. This is particularly useful for web APIs that need to return JSON data directly from the database.

### Basic JSON Array Output

```typescript
const query = SelectQueryParser.parse(`
  SELECT 
    id,
    name,
    email 
  FROM users 
  WHERE active = true
`);

// Create a JSON formatter
const jsonFormatter = new JSONFormatter();

// Generate JSON-returning SQL
const jsonSql = jsonFormatter.visit(query);

console.log(jsonSql);
// OUTPUT:
// SELECT COALESCE(jsonb_agg(jsonb_build_object(
//   'id', "id",
//   'name', "name",
//   'email', "email"
// )), '[]') AS result
// FROM "users"
// WHERE "active" = true
```

### Nested JSON Structures

For more complex data models, you can use the `groupBy` option to create nested JSON objects:

```typescript
const complexQuery = SelectQueryParser.parse(`
  SELECT
    u.id,
    u.name,
    u.email,
    o.id as order_id,
    o.total as order_total,
    o.order_date
  FROM users u
  JOIN orders o ON u.id = o.user_id
  WHERE u.status = 'active'
`);

// Format with groupBy option to create nested JSON structure
const complexJsonSql = new JSONFormatter({ 
  groupBy: {
    'users': ['id', 'name', 'email'],
    'orders': ['order_id', 'order_total', 'order_date']
  }
}).visit(complexQuery);

// This will produce a nested JSON structure with orders as a nested array within each user
```

### JSONFormatter Options

- `useJsonb`: Boolean (default: true) - Whether to use PostgreSQL's `jsonb_agg` (true) or `json_agg` (false).
- `groupBy`: Object - Defines how columns should be grouped into nested structures. Keys are group names, values are arrays of column names.

---

### overrideSelectItemExpr
Overrides a SELECT item using its SQL expression. The callback receives the original SQL expression as a string and returns a new SQL string.

```typescript
// Override the SELECT item 'journal_date' to use greatest(journal_date, DATE '2025-01-01')
query.overrideSelectItemExpr('journal_date', expr => `greatest(${expr}, DATE '2025-01-01')`);
```

---

## AST Transformer Features

A suite of utilities for transforming and analyzing SQL ASTs.

### Main Transformers

- **SqlFormatter**
  Converts ASTs to formatted SQL strings. Handles identifier escaping. Supports both single-line (compact) and multi-line (formatted) styles.
- **JSONFormatter**
  Transforms SELECT queries to return JSON array results using PostgreSQL JSON functions. Supports both flat and nested JSON structures.
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

- **QueryBuilder**  
  Converts any SELECT/UNION/VALUES query into a standard SimpleSelectQuery. Handles subquery wrapping and automatic column name generation.
  Supports CREATE TABLE ... AS SELECT ... conversion:
  - `QueryBuilder.buildCreateTableQuery(query, tableName, isTemporary?)` creates a `CreateTableQuery` from any SELECT query.
  Supports combining multiple queries:
  - `QueryBuilder.buildBinaryQuery(queries, operator)` combines an array of SelectQuery objects into a single BinarySelectQuery using the specified set operator (e.g., 'union', 'intersect', 'except').
  Supports INSERT and UPDATE statement generation from SELECT:
  - `QueryBuilder.buildInsertQuery(selectQuery, tableName)` creates an `InsertQuery` from a `SimpleSelectQuery` and a target table name.  
    The columns are inferred from the select query. Throws if columns cannot be determined.
  - `QueryBuilder.buildUpdateQuery(selectQuery, selectSourceName, updateTableExprRaw, primaryKeys)` creates an `UpdateQuery` from a `SimpleSelectQuery`, the source alias, the update target table, and primary key(s).  
    This generates an UPDATE ... SET ... FROM ... WHERE ... statement using the SELECT as the value source. Throws if PK columns are missing or ambiguous.

- **TableColumnResolver**  
  A function type for resolving column names from a table name, mainly used for wildcard expansion (e.g., `table.*`). Used by analyzers like SelectValueCollector.
  ```typescript
  export type TableColumnResolver = (tableName: string) => string[];
  ```

> [!NOTE]
> As of version 0.4.0-beta, the class previously named `QueryConverter` has been renamed to `QueryBuilder`, and its methods have been updated for consistency. The new `buildBinaryQuery` method was also introduced, allowing you to combine multiple `SelectQuery` objects into a single set operation query. These are breaking changes. If you were using `QueryConverter` in earlier versions, please update your code to use `QueryBuilder` and the new method names (e.g., `buildCreateTableQuery`, `buildBinaryQuery`).

---

## Usage Example

```typescript
import { TableColumnResolver, SelectQueryParser, SelectableColumnCollector, SelectValueCollector, TableSourceCollector, SqlFormatter } from 'rawsql-ts';

// TableColumnResolver example
const resolver: TableColumnResolver = (tableName) => {
    if (tableName === 'users') return ['user_id', 'user_name', 'email'];
    if (tableName === 'posts') return ['post_id', 'user_id', 'title', 'content'];
    return [];
};

const sql = `SELECT u.*, p.title as post_title FROM users u INNER JOIN posts p ON u.user_id = p.user_id`;
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter();

// Collects information from the SELECT clause.
// To expand wildcards, you must specify a TableColumnResolver.
const selectValueCollector = new SelectValueCollector(resolver);
const selectValues = selectValueCollector.collect(query);
// Log the name and formatted value of each select value
console.log('Select values:');
selectValues.forEach(val => {
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value).formattedSql}`);
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
    console.log(`  name: ${val.name}, value: ${formatter.format(val.value).formattedSql}`);
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
import { QueryBuilder, SelectQueryParser, SqlFormatter } from 'rawsql-ts';

const select = SelectQueryParser.parse('SELECT id, name FROM users');
const create = QueryBuilder.buildCreateTableQuery(select, 'my_table');
const sqlCreate = new SqlFormatter().format(create).formattedSql;
console.log(sqlCreate);
// => create table "my_table" as select "id", "name" from "users"

const createTemp = QueryBuilder.buildCreateTableQuery(select, 'tmp_table', true);
const sqlTemp = new SqlFormatter().format(createTemp).formattedSql;
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
import { SelectQueryParser, SqlFormatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query
const query = SelectQueryParser.parse('SELECT u.user_id, u.name FROM users u') as SimpleSelectQuery;

// Add LEFT JOIN using the leftJoinRaw method (join on user_id)
query.leftJoinRaw('orders', 'o', ['user_id']);

// Add WHERE clause
query.appendWhereRaw('o.order_id IS NULL');

const formatter = new SqlFormatter();
const formattedSql = formatter.format(query).formattedSql;

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
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.029 |  0.0087 |  0.0044 |                - |
| node-sql-parser                |    0.210 |  0.4505 |  0.2298 |             7.3x |
| sql-formatter                  |    0.228 |  0.1598 |  0.0815 |             8.0x |

> [!Note] When the token count is extremely low, `rawsql-ts` becomes disproportionately fast. However, such small queries are rare in real-world scenarios, so this result is excluded from the overall performance summary.

#### Tokens70
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.075 |  0.0541 |  0.0276 |                - |
| node-sql-parser                |    0.223 |  0.0848 |  0.0432 |             3.0x |
| sql-formatter                  |    0.547 |  0.1432 |  0.0731 |             7.3x |

#### Tokens140
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.137 |  0.0175 |  0.0089 |                - |
| node-sql-parser                |    0.420 |  0.1030 |  0.0526 |             3.1x |
| sql-formatter                  |    1.057 |  0.2390 |  0.1220 |             7.7x |

#### Tokens230
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.239 |  0.0577 |  0.0294 |                - |
| node-sql-parser                |    0.871 |  0.2042 |  0.1042 |             3.6x |
| sql-formatter                  |    1.906 |  1.4631 |  0.7465 |             8.0x |

### Performance Summary

- `rawsql-ts` remains one of the fastest parsers, though it is approximately 10% slower in version 0.7 compared to previous versions. This is due to the addition of enhanced parameterized query parsing and SQL formatting capabilities.
- About 3–4x faster than `node-sql-parser`.
- About 4–5x faster than `sql-parser-cst`.
- About 7–8x faster than `sql-formatter`.
- Maintains high performance even for complex SQL, while providing comprehensive features.

> **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and query complexity.

---

Feel free to try rawsql-ts! Questions, requests, and bug reports are always welcome.
