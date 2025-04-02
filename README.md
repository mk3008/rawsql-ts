# carbunqlex-ts

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
- **One-line Formatting**: Only supports single-line formatting output
- **Beta Status**: API may change without notice until v1.0 release

## Benchmarks

This project includes benchmarking functionality.
To run benchmarks:

```bash
# Run the benchmarks directly from the project root
npm run benchmark
```

### Benchmark Details

The benchmarks measure the performance of SQL parsing and formatting against popular libraries like `sql-formatter` and `node-sql-parser`. We test queries of varying complexity:

- **Tokens20**: Simple SELECT query with basic WHERE condition (~20 tokens)
- **Tokens70**: Medium complexity query with JOINs and multiple conditions (~70 tokens)
- **Tokens140**: Complex query with CTEs and aggregations (~140 tokens)
- **Tokens230**: Very complex query with multiple CTEs, subqueries, and window functions (~230 tokens)

### Results

Here are the performance results from a sample benchmark run:

```
BenchmarkTS, Windows_NT 10.0.26100
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
Node.js v22.14.0
```

| Method                      | Mean       | Error     | StdDev    |
|----------------------------|----------:|----------:|----------:|
| carbunqlex-ts Tokens20     |   0.032 ms |  0.0037 ms |  0.0019 ms |
| carbunqlex-ts Tokens70     |   0.085 ms |  0.0096 ms |  0.0049 ms |
| node-sql-parser Tokens20   |   0.166 ms |  0.0561 ms |  0.0286 ms |
| carbunqlex-ts Tokens140    |   0.170 ms |  0.0189 ms |  0.0096 ms |
| node-sql-parser Tokens70   |   0.214 ms |  0.0609 ms |  0.0311 ms |
| sql-formatter Tokens20     |   0.216 ms |  0.0263 ms |  0.0134 ms |
| carbunqlex-ts Tokens230    |   0.291 ms |  0.0307 ms |  0.0156 ms |
| node-sql-parser Tokens140  |   0.396 ms |  0.0410 ms |  0.0209 ms |
| sql-formatter Tokens70     |   0.540 ms |  0.0947 ms |  0.0483 ms |
| node-sql-parser Tokens230  |   0.788 ms |  0.0823 ms |  0.0420 ms |
| sql-formatter Tokens140    |   1.050 ms |  0.3101 ms |  0.1582 ms |
| sql-formatter Tokens230    |   1.780 ms |  0.1356 ms |  0.0692 ms |

### Performance Summary

- **carbunqlex-ts** consistently outperforms both `node-sql-parser` and `sql-formatter` across all test cases
- 2.5-3x faster than `node-sql-parser`
- 3-6x faster than `sql-formatter`
- The performance gap increases with query complexity

The benchmarks show that this library is substantially faster than popular alternatives while maintaining full SQL parsing capabilities.