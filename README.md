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
benchmark.js v2.1.4, Windows_NT 10.0.26100
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
Node.js v22.14.0
```

### Tokens20
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.033 ms |  0.0030 ms |  0.0015 ms |
| node-sql-parser                |    0.177 ms |  0.0640 ms |  0.0327 ms |
| sql-formatter                  |    0.215 ms |  0.0347 ms |  0.0177 ms |

### Tokens70
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.085 ms |  0.0085 ms |  0.0043 ms |
| node-sql-parser                |    0.239 ms |  0.1297 ms |  0.0662 ms |
| sql-formatter                  |    0.539 ms |  0.0695 ms |  0.0355 ms |

### Tokens140
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.170 ms |  0.0234 ms |  0.0120 ms |
| node-sql-parser                |    0.422 ms |  0.0605 ms |  0.0309 ms |
| sql-formatter                  |    1.031 ms |  0.0842 ms |  0.0430 ms |

### Tokens230
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.285 ms |  0.0344 ms |  0.0176 ms |
| node-sql-parser                |    0.872 ms |  0.1366 ms |  0.0697 ms |
| sql-formatter                  |    1.781 ms |  0.1566 ms |  0.0799 ms |

### Performance Summary

- **carbunqlex-ts** consistently outperforms both `node-sql-parser` and `sql-formatter` across all test cases
- 2-3x faster than `node-sql-parser`
- 5-6x faster than `sql-formatter` 
- The performance gap increases with query complexity

The benchmarks show that this library is substantially faster than popular alternatives while maintaining full SQL parsing capabilities.