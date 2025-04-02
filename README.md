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

## Benchmark Details

This benchmark evaluates the SQL parsing and formatting performance of `carbunqlex-ts` against popular libraries: `sql-formatter` and `node-sql-parser`. We test queries of varying complexity:

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
| `carbunqlex-ts`                |    0.018 ms |  0.0041 ms |  0.0021 ms |
| `node-sql-parser`              |    0.190 ms |  0.1433 ms |  0.0731 ms |
| `sql-formatter`                |    0.211 ms |  0.0513 ms |  0.0262 ms |

### Tokens70
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                |    0.048 ms |  0.0125 ms |  0.0064 ms |
| node-sql-parser              |    0.226 ms |  0.1837 ms |  0.0937 ms |
| sql-formatter                |    0.517 ms |  0.1240 ms |  0.0633 ms |

### Tokens140
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                |    0.092 ms |  0.0194 ms |  0.0099 ms |
| node-sql-parser              |    0.415 ms |  0.1106 ms |  0.0564 ms |
| sql-formatter                |    1.017 ms |  0.2119 ms |  0.1081 ms |

### Tokens230
| Method                            | Mean       | Error     | StdDev    |
|---------------------------------- |-----------:|----------:|----------:|
| carbunqlex-ts                |    0.180 ms |  0.1397 ms |  0.0713 ms |
| node-sql-parser              |    0.846 ms |  0.2805 ms |  0.1431 ms |
| sql-formatter                |    1.767 ms |  0.3475 ms |  0.1773 ms |

## Performance Summary

- `carbunqlex-ts` **consistently outperforms** both `node-sql-parser` and `sql-formatter` in all tested cases.
- **4x faster** than `node-sql-parser`.
- **9-10x faster** than `sql-formatter`.
- Maintains **full SQL parsing capabilities** while significantly improving performance.

> ⚠️ **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and workload.
