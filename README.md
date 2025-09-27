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

## 📦 Packages

This is a monorepo containing multiple packages:

- **[rawsql-ts](./packages/core)** - Core SQL parsing and transformation library
- **(Prisma integration removed)** - Prisma-specific integration has been removed from this monorepo.

---

## Key Features

- **Zero dependencies**: Fully self-contained and lightweight
- **High-performance**: Over 3x faster than major SQL parsing libraries
- **Dynamic SQL generation**: Flexible parameter injection, sorting, and pagination
- **Type-safe**: Full TypeScript support with schema validation
- **Browser ready**: Works in browsers via CDN (unpkg/jsdelivr)
- **PostgreSQL JSON**: Transform relational queries into hierarchical JSON structures

For detailed feature documentation, see the [Core Package Documentation](./packages/core/README.md).

![Benchmark Results](https://quickchart.io/chart?c={type:'bar',data:{labels:['Tokens20','Tokens70','Tokens140','Tokens230'],datasets:[{label:'rawsql-ts',data:[0.029,0.075,0.137,0.239],backgroundColor:'rgba(54,162,235,0.8)',borderColor:'rgba(54,162,235,1)',borderWidth:1},{label:'node-sql-parser',data:[0.210,0.223,0.420,0.871],backgroundColor:'rgba(255,206,86,0.8)',borderColor:'rgba(255,206,86,1)',borderWidth:1},{label:'sql-formatter',data:[0.228,0.547,1.057,1.906],backgroundColor:'rgba(255,99,132,0.8)',borderColor:'rgba(255,99,132,1)',borderWidth:1}]},options:{plugins:{legend:{labels:{color:'black'}}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=700&height=450)

> [!Note]
> The "Mean" column represents the average time taken to process a query. Lower values indicate faster performance. For more details, see the [Benchmark](#benchmarks).

---

## Quick Start

### Installation

```bash
npm install rawsql-ts
```

### Your First Dynamic Query

Experience the power of rawsql-ts with `DynamicQueryBuilder` - build complex queries with filtering, sorting, pagination, and JSON serialization in one go!

```typescript
import { DynamicQueryBuilder, SqlFormatter } from 'rawsql-ts';

// Start with a simple base SQL
const baseSql = 'SELECT id, name, email, created_at FROM users WHERE active = true';

// Build a complete dynamic query with all features
const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  // Dynamic filtering
  filter: { 
    status: 'premium', 
    created_at: { '>': '2024-01-01' } 
  },
  // Dynamic sorting
  sort: { 
    created_at: { desc: true }, 
    name: { asc: true } 
  },
  // Dynamic pagination
  paging: { 
    page: 2, 
    pageSize: 10 
  },
  // JSON serialization (optional)
  serialize: {
    rootName: 'user',
    rootEntity: { 
      id: 'user', 
      name: 'User', 
      columns: { id: 'id', name: 'name', email: 'email', createdAt: 'created_at' } 
    },
    nestedEntities: []
  }
});

// Format and execute
const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);

console.log('Generated SQL:');
console.log(formattedSql);
// Output: Optimized PostgreSQL JSON query with filtering, sorting, and pagination

console.log('Parameters:');
console.log(params);
// Output: { status: 'premium', created_at_gt: '2024-01-01' }
```

### Next Steps

Ready for more advanced features? Check out:

1. **[Core Package Documentation](./packages/core/README.md)** - Complete SQL parsing, transformation, and all available classes
2. **[Model-Driven JSON Mapping Guide](./docs/usage-guides/model-driven-json-mapping-usage-guide.md)** - Transform SQL results into structured TypeScript models

---

### Advanced Features & Documentation

For comprehensive documentation and advanced use cases:

### Core Package
- **[Complete Documentation](./packages/core/README.md)** - All classes, methods, and advanced features
- **[Usage Guides](./docs/usage-guides/)** - Step-by-step guides for each component

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
