# rawsql-ts

rawsql-ts is a TypeScript SQL parser that performs Abstract Syntax Tree (AST) analysis for advanced SQL processing and transformation.

> **Note:** This library is currently in beta. The API may change without notice until the v1.0 release.

## Installation

Install the package from npm as follows:

```bash
npm install rawsql-ts
```

## Usage

Basic usage example:

```typescript
import { SelectQueryParser } from 'rawsql-ts';
import { Formatter } from 'rawsql-ts';

const sql = `SELECT id, name FROM users WHERE active = TRUE`;
const query = SelectQueryParser.parseFromText(sql);
const formatter = new Formatter();
const formattedSql = formatter.visit(query);
console.log(formattedSql);
// => select "id", "name" from "users" where "active" = true
```

---

## 🧩 Parsing Features

rawsql-ts provides the following main parser class for converting SQL text into an Abstract Syntax Tree (AST):

- **SelectQueryParser**  
  Parses complete SELECT and VALUES queries, including support for CTEs (WITH), UNION/INTERSECT/EXCEPT, subqueries, and all major SQL clauses. Handles PostgreSQL-specific syntax and advanced query structures.

 **Key methods:**
  - `parseFromText(sql: string): SelectQuery`  
    Parses a SQL string and returns the root AST node for the query. Throws an error if the SQL is invalid or contains extra tokens.
  - `parse(lexemes: Lexeme[], index: number): { value: SelectQuery; newIndex: number }`  
    Parses a tokenized SQL query from the given index and returns the AST node and the new index. Used internally for advanced parsing scenarios.

  **Notes:**
  - Only PostgreSQL syntax is supported at this time.
  - Only SELECT and VALUES queries are supported (INSERT/UPDATE/DELETE are not yet implemented).
  - All SQL comments are removed during parsing.

  This class is designed to handle all practical SQL parsing needs for SELECT/VALUES queries in PostgreSQL, including:
  - CTEs (WITH), including recursive and materialized options
  - UNION, INTERSECT, EXCEPT, and subqueries
  - Window functions and analytic clauses
  - Complex expressions, functions, and operators
  - Robust error handling with detailed messages
  - Accurate tokenization, including comments and special literals

---

## Core SQL Query Classes

The following classes are the primary building blocks for representing and manipulating SQL queries in rawsql-ts:

### SimpleSelectQuery

Represents a single, standard SQL SELECT statement (not a UNION or VALUES). This class encapsulates all major clauses such as SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, and more.

**Key methods:**
- `toUnion`, `toUnionAll`, `toIntersect`, `toExcept`, etc.
  - Combine this query with another using UNION, INTERSECT, EXCEPT, etc., returning a BinarySelectQuery.
- `appendWhere`, `appendWhereRaw`
  - Add a new condition to the WHERE clause (as AST or raw SQL string).
- `appendHaving`, `appendHavingRaw`
  - Add a new condition to the HAVING clause.
- `innerJoin`, `leftJoin`, `rightJoin`, `innerJoinRaw`, etc.
  - Add JOIN clauses to the query, either as AST or from raw SQL.
- `toSource`
  - Wrap this query as a subquery (for use in FROM/JOIN, etc.).
- `appendWith`, `appendWithRaw`
  - Add CTEs (WITH clause) to the query.

### BinarySelectQuery

Represents a binary SQL query, such as `SELECT ... UNION SELECT ...`, `INTERSECT`, or `EXCEPT`. This class holds a left and right query and the operator between them.

**Key methods:**
- `union`, `unionAll`, `intersect`, `intersectAll`, `except`, `exceptAll`
  - Chain additional queries to the current binary query.
- `appendSelectQuery`
  - Add a new query with a custom operator.
- `toSource`
  - Wrap this binary query as a subquery (for use in FROM/JOIN, etc.).
- `unionRaw`, `intersectRaw`, etc.
  - Add a new query by parsing a raw SQL string and combining it.

### ValuesQuery

Represents a SQL `VALUES` clause, such as `VALUES (1, 'a'), (2, 'b')`, which is used for inline data tables.

**Key methods:**
- (Primarily the constructor and tuple access)
- This class can be used as a subquery source or wrapped with QueryNormalizer to convert it into a standard SELECT query.

---

These classes are designed to be flexible and allow for robust construction, combination, and transformation of SQL queries. For further details, please refer to the source code.

---

## 🛠️ Transformer Features (AST Transformers)

rawsql-ts provides a suite of AST (Abstract Syntax Tree) transformers for advanced SQL analysis and manipulation. These utilities are intended for engineers who require programmatic extraction, analysis, or transformation of SQL query structures.

### Main Transformers

- **Formatter**  
  Converts SQL ASTs into standardized SQL text, handling identifier escaping and formatting for all SQL components.  
  **Note:** Output formatting is currently limited to single-line (compact) style.

- **SelectValueCollector**  
  Extracts all columns, including aliases and expressions, from SELECT clauses. Supports wildcard expansion (e.g., `*`, `table.*`) when table structure information is provided.

- **SelectableColumnCollector**  
  Collects all column references in a query that can be included in a SELECT clause. Gathers all columns available from root FROM/JOIN sources.

- **CTECollector**  
  Collects all Common Table Expressions (CTEs) from WITH clauses, subqueries, and UNION queries. Supports both nested and recursive CTEs.

- **UpstreamSelectQueryFinder**  
  Identifies upstream SELECT queries that provide specific columns by traversing CTEs, subqueries, and UNION branches.

- **CTENormalizer**  
  Consolidates all Common Table Expressions (CTEs) from any part of a query (including nested subqueries, JOINs, and UNIONs) into a single root-level WITH clause. If duplicate CTE names with different definitions are detected, an error is thrown to prevent ambiguity.

- **QueryNormalizer**  
  Converts any SELECT query (including UNION, EXCEPT, or VALUES queries) into a standard SimpleSelectQuery format. For UNION or EXCEPT, the query is wrapped as a subquery with an alias (e.g., SELECT * FROM (...)). For VALUES, sequential column names (column1, column2, ...) are generated and the VALUES are wrapped in a subquery. This ensures a predictable query structure for downstream processing.

--- 

### Example Usage

```typescript
import { SelectQueryParser } from 'rawsql-ts';
import { SelectableColumnCollector } from 'rawsql-ts/transformers/SelectableColumnCollector';

const sql = `SELECT u.id, u.name FROM users u JOIN posts p ON u.id = p.user_id`;
const query = SelectQueryParser.parseFromText(sql);

const collector = new SelectableColumnCollector();
const columns = collector.collect(query);
console.log(columns.map(col => col.name)); // ["id", "name", "user_id", ...]
```

---

By utilizing these transformer utilities, you can perform advanced SQL analysis and manipulation with reliability and consistency.

## Benchmarks

This project includes benchmarking functionality. To run benchmarks, execute:

```bash
npm run benchmark
```

## Benchmark Details

The benchmark suite evaluates the SQL parsing and formatting performance of `rawsql-ts` in comparison to popular libraries such as `sql-formatter` and `node-sql-parser`. Queries of varying complexity are tested:

- **Tokens20**: Simple `SELECT` query with a basic `WHERE` condition (~20 tokens)
- **Tokens70**: Medium complexity query with `JOIN`s and multiple conditions (~70 tokens)
- **Tokens140**: Complex query with `CTE`s and aggregations (~140 tokens)
- **Tokens230**: Highly complex query with multiple `CTE`s, subqueries, and window functions (~230 tokens)

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

- `rawsql-ts` consistently outperforms both `node-sql-parser` and `sql-formatter` in all tested scenarios.
- Approximately 4x faster than `node-sql-parser`.
- Approximately 9-10x faster than `sql-formatter`.
- Maintains comprehensive SQL parsing capabilities while delivering significant performance improvements.

> **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and workload.

## Practical Example: Table Join

Let's see how easy it is to join two tables using rawsql-ts! You don't need to know the internal structure of SelectQuery or worry about alias names—just specify the join key(s) and the library will generate the ON clause for you automatically.

```typescript
import { SelectQueryParser } from 'rawsql-ts';
import { Formatter } from 'rawsql-ts';

// Parse two separate queries
const userQuery = SelectQueryParser.parseFromText('SELECT user_id, user_name FROM users');
const postQuery = SelectQueryParser.parseFromText('SELECT post_id, user_id, title FROM posts');

// Join the two queries using innerJoin
// Just pass the join key(s) as an array, and the ON clause will be generated automatically!
const joinedQuery = userQuery.innerJoin(postQuery, ['user_id']);

// Format the joined query back to SQL
const formatter = new Formatter();
const sql = formatter.visit(joinedQuery);
console.log(sql);
// Output:
// select "user_id", "user_name", "post_id", "title" from "users" inner join (select "post_id", "user_id", "title" from "posts") on "users"."user_id" = "posts"."user_id"
```

**Point:**
- You do not need to understand the internal code of SelectQuery to perform joins.
- You only need to specify the join key(s) (e.g., `['user_id']`). The ON clause is generated for you.
- Alias names and subquery details are handled automatically by the library, so you never have to worry about them!
- This makes it super easy to join queries, even if you don't know the full structure of the SQL or the internal AST.
