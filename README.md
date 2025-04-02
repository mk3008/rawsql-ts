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
| carbunqlex-ts                  |    0.028 ms |  0.0028 ms |  0.0014 ms |
| node-sql-parser                |    0.175 ms |  0.0706 ms |  0.0360 ms |
| sql-formatter                  |    0.215 ms |  0.0359 ms |  0.0183 ms |

### Tokens70
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.071 ms |  0.0057 ms |  0.0029 ms |
| node-sql-parser                |    0.221 ms |  0.0340 ms |  0.0173 ms |
| sql-formatter                  |    0.543 ms |  0.0793 ms |  0.0404 ms |

### Tokens140
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.154 ms |  0.0324 ms |  0.0165 ms |
| node-sql-parser                |    0.432 ms |  0.0574 ms |  0.0293 ms |
| sql-formatter                  |    1.101 ms |  0.2124 ms |  0.1084 ms |

### Tokens230
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                  |    0.250 ms |  0.0646 ms |  0.0330 ms |
| node-sql-parser                |    0.871 ms |  0.1234 ms |  0.0629 ms |
| sql-formatter                  |    1.790 ms |  0.1754 ms |  0.0895 ms |

### Performance Summary

- **carbunqlex-ts** consistently outperforms both `node-sql-parser` and `sql-formatter` across all test cases
- 2-3x faster than `node-sql-parser`
- 5-6x faster than `sql-formatter` 
- The performance gap increases with query complexity

The benchmarks show that this library is substantially faster than popular alternatives while maintaining full SQL parsing capabilities.