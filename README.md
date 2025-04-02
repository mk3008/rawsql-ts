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
| Method            | Mean     | Error    | StdDev   |
|------------------|---------:|---------:|---------:|
| `carbunqlex-ts` | 0.018 ms | 0.0041 ms | 0.0021 ms |
| `node-sql-parser` | 0.180 ms | 0.0983 ms | 0.0502 ms |
| `sql-formatter` | 0.221 ms | 0.1295 ms | 0.0661 ms |

### Tokens70
| Method            | Mean     | Error    | StdDev   |
|------------------|---------:|---------:|---------:|
| `carbunqlex-ts` | 0.050 ms | 0.0114 ms | 0.0058 ms |
| `node-sql-parser` | 0.225 ms | 0.0899 ms | 0.0459 ms |
| `sql-formatter` | 0.540 ms | 0.1947 ms | 0.0993 ms |

### Tokens140
| Method            | Mean     | Error    | StdDev   |
|------------------|---------:|---------:|---------:|
| `carbunqlex-ts` | 0.102 ms | 0.0533 ms | 0.0272 ms |
| `node-sql-parser` | 0.416 ms | 0.1864 ms | 0.0951 ms |
| `sql-formatter` | 1.036 ms | 0.4597 ms | 0.2345 ms |

### Tokens230
| Method            | Mean     | Error    | StdDev   |
|------------------|---------:|---------:|---------:|
| `carbunqlex-ts` | 0.176 ms | 0.1572 ms | 0.0802 ms |
| `node-sql-parser` | 0.858 ms | 0.2193 ms | 0.1119 ms |
| `sql-formatter` | 1.765 ms | 0.4169 ms | 0.2127 ms |

## Performance Summary

- `carbunqlex-ts` **consistently outperforms** both `node-sql-parser` and `sql-formatter` in all tested cases.
- **Up to 4x faster** than `node-sql-parser`.
- **Up to 10x faster** than `sql-formatter`.
- Maintains **full SQL parsing capabilities** while significantly improving performance.

> ⚠️ **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and workload.
