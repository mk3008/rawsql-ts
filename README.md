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

![Benchmark Results](https://quickchart.io/chart?c={type:'bar',data:{labels:['Tokens20','Tokens70','Tokens140','Tokens230'],datasets:[{label:'rawsql-ts',data:[0.038,0.096,0.181,0.317],backgroundColor:'rgba(54,162,235,0.8)',borderColor:'rgba(54,162,235,1)',borderWidth:1},{label:'node-sql-parser',data:[0.345,0.356,0.601,1.323],backgroundColor:'rgba(255,206,86,0.8)',borderColor:'rgba(255,206,86,1)',borderWidth:1},{label:'sql-formatter',data:[0.217,0.525,1.012,1.767],backgroundColor:'rgba(255,99,132,0.8)',borderColor:'rgba(255,99,132,1)',borderWidth:1}]},options:{plugins:{legend:{labels:{color:'black'}}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=700&height=450)

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

## Versioning

This workspace relies on [Changesets](https://github.com/changesets/changesets) with **independent per-package versioning**. There are no `fixed` groups in `.changeset/config.json`, so a changeset only bumps the packages it lists and leaves the others untouched. When you introduce a change that should be published:

1. Run `pnpm changeset` and select the affected packages plus the release type (patch/minor/major); this creates the changelog fragment.
2. The Release PR workflow (`.github/workflows/release-pr.yml` via `changesets/action@v1`) uses those fragments to run `pnpm changeset version`, update `package.json`/changelog, and open or refresh the Release PR with the proposed release.
3. Merge the Release PR after CI passes; publishing follows the workflow configured in `release-pr.yml` (which already runs `pnpm changeset publish` or equivalent for the merged packages).

The `workspace:^` dependency specifiers and this independent configuration keep the local development workflow smooth while letting the CI publish each package on its own cadence.

Internal dependencies should default to `workspace:^` so they only trigger releases when runtime semantics actually change; reserve `workspace:*` for the rare case when strict lockstep across packages is intentionally required.

## Publishing

Publishing requires valid npm credentials and public access for scoped packages.

1. Verify authentication before publishing:

   ```bash
   npm whoami
   ```

2. If authentication fails, sign in again (or refresh CI tokens):

   ```bash
   npm login
   ```

3. Ensure scoped packages publish publicly. This repo sets `publishConfig.access = "public"` for `@rawsql-ts/*`, but you can also pass `--access public` if publishing manually.

4. Publish the changesets:

   ```bash
   pnpm changeset publish
   ```

If you see `E404 Not Found` along with `Access token expired or revoked`, the npm token is no longer valid for the registry or scope. Refresh the token and retry.

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
| rawsql-ts                      |    0.038 |  0.0115 |  0.0059 |                - |
| node-sql-parser                |    0.345 |  0.2803 |  0.1430 |             9.1x |
| sql-formatter                  |    0.217 |  0.0580 |  0.0296 |             5.7x |

> [!Note] When the token count is extremely low, `rawsql-ts` becomes disproportionately fast. However, such small queries are rare in real-world scenarios, so this result is excluded from the overall performance summary.

#### Tokens70
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.096 |  0.0341 |  0.0174 |                - |
| node-sql-parser                |    0.356 |  0.0973 |  0.0496 |             3.7x |
| sql-formatter                  |    0.525 |  0.1138 |  0.0581 |             5.4x |

#### Tokens140
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.181 |  0.0626 |  0.0319 |                - |
| node-sql-parser                |    0.601 |  0.1427 |  0.0728 |             3.3x |
| sql-formatter                  |    1.012 |  0.2079 |  0.1061 |             5.6x |

#### Tokens230
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.317 |  0.0857 |  0.0437 |                - |
| node-sql-parser                |    1.323 |  0.3186 |  0.1625 |             4.2x |
| sql-formatter                  |    1.767 |  0.4186 |  0.2136 |             5.6x |

### Performance Summary

- Lazy comment handling now skips zero-allocation paths, making tokenization roughly 5–7% faster than the earlier 2025-10-10 build.
- Around 4x faster than node-sql-parser across the measured workloads.
- Around 5-6x faster than sql-formatter while still producing AST output.
- Maintains high performance even for complex SQL, while providing comprehensive features.
> **Note:** These benchmarks are based on a specific hardware and software environment. Actual performance may vary depending on system configuration and query complexity.

---

Feel free to try rawsql-ts! Questions, requests, and bug reports are always welcome.
