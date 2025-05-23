# rawsql-ts

![No external dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Browser Support](https://img.shields.io/badge/browser-%F0%9F%9A%80-brightgreen)
![npm version](https://img.shields.io/npm/v/rawsql-ts)
![npm downloads](https://img.shields.io/npm/dm/rawsql-ts)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

🌐 [Online Demo (GitHub Pages)](https://mk3008.github.io/rawsql-ts/)

rawsql-ts is a high-performance SQL parser and AST transformer library written in TypeScript. It empowers you to represent raw SQL as objects, enabling flexible manipulation of SQL statements directly within your program. This object-oriented approach allows for partial transformation, decomposition into manageable components, and recombination as needed, dramatically improving the maintainability and reusability of complex SQL.

It is designed for extensibility and advanced SQL analysis, with initial focus on PostgreSQL syntax but not limited to it. The library enables easy SQL parsing, transformation, and analysis for a wide range of SQL dialects.

> [!Note]
> This library is currently in beta. The API may change until the v1.0 release.

---

## Key Features

- Zero dependencies: fully self-contained and lightweight
- High-speed SQL parsing and AST analysis (over 3x faster than major libraries)
- Rich utilities for SQL structure transformation and analysis
- Advanced SQL formatting capabilities, including multi-line formatting and customizable styles
- Dynamic SQL parameter injection for building flexible search queries with `SqlParamInjector`
- Static query validation and regression testing against your database schema with `SqlSchemaValidator`, enabling early error detection and robust unit tests for schema changes.

![Benchmark Results](https://quickchart.io/chart?c={type:'bar',data:{labels:['Tokens20','Tokens70','Tokens140','Tokens230'],datasets:[{label:'rawsql-ts',data:[0.029,0.075,0.137,0.239],backgroundColor:'rgba(54,162,235,0.8)',borderColor:'rgba(54,162,235,1)',borderWidth:1},{label:'node-sql-parser',data:[0.210,0.223,0.420,0.871],backgroundColor:'rgba(255,206,86,0.8)',borderColor:'rgba(255,206,86,1)',borderWidth:1},{label:'sql-formatter',data:[0.228,0.547,1.057,1.906],backgroundColor:'rgba(255,99,132,0.8)',borderColor:'rgba(255,99,132,1)',borderWidth:1}]},options:{plugins:{legend:{labels:{color:'black'}}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=700&height=450)

> [!Note]
> The "Mean" column represents the average time taken to process a query. Lower values indicate faster performance. For more details, see the [Benchmark](#benchmarks).

## Browser & CDN Ready

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

---

## Quick Start

---

Kickstart your project by dynamically injecting parameters with `SqlParamInjector` for flexible query generation right from the start!

```typescript
import { SqlParamInjector, SqlFormatter } from 'rawsql-ts';

// Define a base SQL query with an alias, using TRUE for boolean conditions
const baseSql = `SELECT u.user_id, u.user_name, u.email FROM users as u WHERE u.active = TRUE`;

<<<<<<< HEAD
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
=======
// Imagine you have search parameters from a user's input
const searchParams = {
  user_name: { like: '%Alice%' }, // Find users whose name contains 'Alice'
  email: 'specific.email@example.com' // And have a specific email
>>>>>>> main
};

const injector = new SqlParamInjector();
// Dynamically inject searchParams into the baseSql
const query = injector.inject(baseSql, searchParams);

// Format the dynamically generated query (e.g., using PostgreSQL preset)
const formatter = new SqlFormatter({ preset: 'postgres' }); 
const { formattedSql, params } = formatter.format(query);

console.log('Dynamically Generated SQL:');
console.log(formattedSql);
// Expected output (PostgreSQL style):
// select "u"."user_id", "u"."user_name", "u"."email"
// from "users" as "u"
// where "u"."active" = true
// and "u"."user_name" like :user_name_like
// and "u"."email" = :email

console.log('\\nParameters:');
console.log(params);
// Expected output:
// { user_name_like: '%Alice%', email: 'specific.email@example.com' }
```

---

## SQL Parsing Features

rawsql-ts provides robust parsers for `SELECT`, `INSERT`, and `UPDATE` statements, automatically handling SQL comments and providing detailed error messages. By converting SQL into a generic Abstract Syntax Tree (AST), it enables a wide variety of transformation processes.

```typescript
import { SelectQueryParser } from 'rawsql-ts';

const sql = `SELECT id, name FROM products WHERE category = 'electronics'`;
const query = SelectQueryParser.parse(sql);
// query object now holds the AST of the SQL
```

For more details on `SelectQueryParser`, see the [SelectQueryParser Usage Guide](./docs/class-SelectQueryParser-usage-guide.md).

---

## SQL Formatter Features

The `SqlFormatter` class is the recommended way to format SQL queries, offering advanced capabilities like indentation, keyword casing, and multi-line formatting.
It also allows for detailed style customization. For example, you can define your own formatting rules:

```typescript
import { SelectQueryParser, SqlFormatter } from 'rawsql-ts';

const customStyle = {
  identifierEscape: {
    start: "",
    end: ""
  },
  parameterSymbol: ":",
  parameterStyle: "named",
  indentSize: 4,
  indentChar: " ",
  newline: "\n",
  keywordCase: "lower",
  commaBreak: "before",
  andBreak: "before"
};

const sqlToFormat = `SELECT u.user_id, u.user_name FROM users as u WHERE status = :active ORDER BY created_at DESC;`;
const queryToFormat = SelectQueryParser.parse(sqlToFormat);
const customFormatter = new SqlFormatter(customStyle);
const { formattedSql: customFormattedSql } = customFormatter.format(queryToFormat);

console.log(customFormattedSql);
/*
select
    u.user_id
    , u.user_name
from
    users as u
where
    status = :active
order by
    created_at desc;
*/
```

For more details, see the [SqlFormatter Usage Guide](./docs/class-SqlFormatter-usage-guide.md).

---

## SqlParamInjector Features

The `SqlParamInjector` class revolutionizes how you build dynamic search queries. Instead of manually constructing different SQL statements for various search conditions, you simply provide a fixed base SQL and a state object. `SqlParamInjector` then dynamically injects parameters and automatically generates the optimal WHERE conditions.

Key benefits include:
- **Simplified Query Management**: Prepare a single base SQL; `SqlParamInjector` handles the variations.
- **Effortless Optimal Queries**: Just pass a state object, and it generates a highly efficient query.
- **Performance-Oriented**: Conditions are intelligently inserted as close to the data source as possible, significantly improving query performance by filtering data early.
- **Zero Conditional Logic in Code**: Forget writing complex IF statements in your application code to handle different filters.
- **Enhanced SQL Reusability**: Your base SQL remains clean and can be reused across different scenarios with varying search criteria.

```typescript
import { SqlParamInjector, SqlFormatter } from 'rawsql-ts';

const sql = `SELECT u.user_id, u.user_name FROM users as u WHERE u.active = TRUE`;
const injector = new SqlParamInjector();
// Inject parameters and generate WHERE conditions
const injectedQuery = injector.inject(sql, { user_id: 42, user_name: 'Alice' });

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(injectedQuery);

console.log(formattedSql);
// Output: select "u"."user_id", "u"."user_name" from "users" as "u" where "u"."active" = true and "u"."user_id" = :user_id and "u"."user_name" = :user_name
console.log(params);
// Output: { user_id: 42, user_name: 'Alice' }
```

For more details, see the [SqlParamInjector Usage Guide](./docs/class-SqlParamInjector-usage-guide.md).

---

## SqlSchemaValidator Features

The `SqlSchemaValidator` class helps ensure your SQL queries are valid against a predefined database schema. It can extract schema information about the physical tables your SQL query depends on. By comparing this extracted information with your defined schema (e.g., a schema definition class), you can statically verify the query's behavior. This enables you to perform regression testing as part of your unit tests when schema definitions change, ensuring that your queries remain compatible.

It checks if the tables and columns referenced in your query actually exist in your schema, and it understands table aliases. If there's a problem, it gives you a clear error message telling you what's wrong and where.

Key benefits include:
- **Schema Validation**: Verifies SQL queries against your database schema.
- **Table and Column Verification**: Confirms the existence of tables and columns used in the query.
- **Alias Aware**: Correctly resolves table aliases.
- **Clear Error Reporting**: Provides descriptive error messages for easy debugging.
- **Static Analysis**: Allows comparison of SQL-derived schema information with predefined schema definitions.
- **Automated Regression Testing**: Facilitates unit testing for schema change impacts on queries.

```typescript
import { SelectQueryParser, SqlSchemaValidator } from 'rawsql-ts';

// Define your database schema
const schema = {
  users: ['user_id', 'user_name', 'email', 'status'],
  orders: ['order_id', 'user_id', 'order_date', 'total_amount']
};

const validator = new SqlSchemaValidator(schema);

// Example: Validate a SELECT query
const validSql = 'SELECT u.user_id, u.user_name FROM users as u WHERE u.status = \'active\'';
const queryToValidate = SelectQueryParser.parse(validSql);

try {
  validator.validate(queryToValidate);
  console.log('Query is valid against the schema.');
} catch (error) {
  console.error('Schema validation failed:', error.message);
}

// Example: Validate a query with a non-existent column
const invalidSql = 'SELECT user_id, non_existent_column FROM users';
const invalidQuery = SelectQueryParser.parse(invalidSql);

try {
  validator.validate(invalidQuery);
} catch (error) {
  console.error('Schema validation error for non-existent column:', error.message);
  // Expected output: Validation failed: Column 'non_existent_column' not found in table 'users'.
}
```

For more details on `SqlSchemaValidator`, see the [SqlSchemaValidator Usage Guide](./docs/class-SqlSchemaValidator-usage-guide.md).

---

## QueryBuilder Features

`QueryBuilder` is a powerful utility that enhances the management and generation of SQL modification queries (such as `INSERT` or `UPDATE`) by leveraging select queries. This approach significantly improves the maintainability of complex data manipulation logic. It allows for the conversion of select queries into corresponding update-type queries, streamlining development and ensuring consistency.

```typescript
import { SelectQueryParser, QueryBuilder, SqlFormatter, QueryNormalizer } from 'rawsql-ts';

// Example: Convert a SELECT query to an UPDATE query
const selectSourceSql = 'SELECT id, new_email AS email, last_login FROM user_updates_source WHERE needs_update = TRUE';
// QueryBuilder.buildUpdateQuery expects a SimpleSelectQuery as input.
// If your source is a complex query (e.g. with UNIONs or CTEs), normalize it first.
const normalizedSelectQuery = QueryNormalizer.normalize(SelectQueryParser.parse(selectSourceSql));

// Define the target table for the UPDATE and the primary key(s) for joining
const targetTable = 'users';
const primaryKeys = ['id']; // Column(s) to match records between source and target

const updateQuery = QueryBuilder.buildUpdateQuery(
  normalizedSelectQuery,
  'd', // Alias of the source query in the FROM clause
  targetTable,
  primaryKeys
);

const formatter = new SqlFormatter({ preset: 'postgres' }); // Using postgres preset for clarity
const { formattedSql: updateSql } = formatter.format(updateQuery);

console.log(updateSql);
// Example output (actual output depends on the SQL dialect and specific query structure):
// update "users" set "email" = "d"."email", "last_login" = "d"."last_login" from (SELECT id, new_email AS email, last_login FROM user_updates_source WHERE needs_update = TRUE) as "d" where "users"."id" = "d"."id"
```

For more details on `QueryBuilder`, see the [QueryBuilder Usage Guide](./docs/class-QueryBuilder-usage-guide.md).

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
