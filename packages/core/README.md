# rawsql-ts

![npm version](https://img.shields.io/npm/v/rawsql-ts)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A high-performance SQL parser and AST transformer written in TypeScript. Parse raw SQL into objects, manipulate query structures programmatically, and generate optimized output — all with zero dependencies.

> [!Note]
> This library is currently in beta. The API may change until the v1.0 release.

## Features

- **Zero dependencies** — fully self-contained and lightweight
- **High-performance** — 3-8x faster than major SQL parsing libraries
- **Browser ready** — works in browsers via CDN (unpkg / jsdelivr)
- **Dynamic query building** — filtering, sorting, pagination, and JSON serialization
- **CTE management** — add, remove, and manipulate CTEs programmatically
- **Schema validation** — static query validation against your database schema
- **Full TypeScript support** — type-safe APIs throughout

## Installation

```bash
npm install rawsql-ts
```

Or use directly in the browser via CDN:

```html
<script type="module">
  import { parse } from "https://unpkg.com/rawsql-ts/dist/esm/index.min.js";
</script>
```

## Quick Start

```typescript
import { DynamicQueryBuilder, SqlFormatter } from 'rawsql-ts';

const baseSql = 'SELECT id, name, email, created_at FROM users WHERE active = true';

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: { status: 'premium', created_at: { '>': '2024-01-01' } },
  sort: { created_at: { desc: true }, name: { asc: true } },
  paging: { page: 2, pageSize: 10 },
});

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);
```

## API Overview

### Parsing

| Class | Description | Docs |
|-------|-------------|------|
| `SelectQueryParser` | Parse SELECT statements into AST | [Guide](../../docs/guide/getting-started.md) |
| `InsertQueryParser` | Parse INSERT statements into AST | [API](../../docs/api/classes/InsertQueryParser.md) |
| `UpdateQueryParser` | Parse UPDATE statements into AST | [API](../../docs/api/classes/UpdateQueryParser.md) |
| `DeleteQueryParser` | Parse DELETE statements into AST | [API](../../docs/api/classes/DeleteQueryParser.md) |

### Query Building

| Class | Description | Docs |
|-------|-------------|------|
| `DynamicQueryBuilder` | All-in-one filtering, sorting, pagination, and serialization | [Guide](../../docs/guide/querybuilding-recipes.md) |
| `QueryBuilder` | Convert SELECT queries into INSERT / UPDATE statements | [API](../../docs/api/classes/QueryBuilder.md) |
| `PostgresJsonQueryBuilder` | Transform relational queries into hierarchical JSON structures | [API](../../docs/api/classes/PostgresJsonQueryBuilder.md) |

### Injection

| Class | Description | Docs |
|-------|-------------|------|
| `SqlParamInjector` | Dynamic WHERE condition injection from parameters | [API](../../docs/api/classes/SqlParamInjector.md) |
| `SqlSortInjector` | Dynamic ORDER BY injection with ASC/DESC and NULLS positioning | [API](../../docs/api/classes/SqlSortInjector.md) |
| `SqlPaginationInjector` | Dynamic LIMIT/OFFSET injection with page-based support | [API](../../docs/api/classes/SqlPaginationInjector.md) |

### Formatting

| Class | Description | Docs |
|-------|-------------|------|
| `SqlFormatter` | SQL formatting with indentation, keyword casing, and comment handling | [Guide](../../docs/guide/formatting-recipes.md) |

### Analysis

| Class | Description | Docs |
|-------|-------------|------|
| `SelectableColumnCollector` | Extract column references for dependency analysis | [API](../../docs/api/classes/SelectableColumnCollector.md) |
| `SqlSchemaValidator` | Validate queries against a database schema definition | [API](../../docs/api/classes/SqlSchemaValidator.md) |
| `QueryFlowDiagramGenerator` | Generate Mermaid flow diagrams from SQL queries | [API](../../docs/api/classes/QueryFlowDiagramGenerator.md) |

### Schema & CTE

| Class | Description | Docs |
|-------|-------------|------|
| `SchemaManager` | Unified schema definition with type-safe format conversion | [API](../../docs/api/classes/SchemaManager.md) |
| `SimpleSelectQuery` | Programmatic CTE management (add, remove, replace) | [API](../../docs/api/classes/SimpleSelectQuery.md) |

## Benchmarks

![Benchmark Results](https://quickchart.io/chart?c={type:'bar',data:{labels:['Tokens20','Tokens70','Tokens140','Tokens230'],datasets:[{label:'rawsql-ts',data:[0.029,0.075,0.137,0.239],backgroundColor:'rgba(54,162,235,0.8)',borderColor:'rgba(54,162,235,1)',borderWidth:1},{label:'node-sql-parser',data:[0.210,0.223,0.420,0.871],backgroundColor:'rgba(255,206,86,0.8)',borderColor:'rgba(255,206,86,1)',borderWidth:1},{label:'sql-formatter',data:[0.228,0.547,1.057,1.906],backgroundColor:'rgba(255,99,132,0.8)',borderColor:'rgba(255,99,132,1)',borderWidth:1}]},options:{plugins:{legend:{labels:{color:'black'}}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=700&height=450)

| Workload | rawsql-ts | node-sql-parser | sql-formatter |
|----------|----------:|----------------:|--------------:|
| Tokens70 | 0.075 ms | 0.223 ms (3.0x) | 0.547 ms (7.3x) |
| Tokens140 | 0.137 ms | 0.420 ms (3.1x) | 1.057 ms (7.7x) |
| Tokens230 | 0.239 ms | 0.871 ms (3.6x) | 1.906 ms (8.0x) |

> Benchmarked on AMD Ryzen 7 7800X3D / Node.js v22.14.0. See [benchmark details](../../docs/bench) for full results.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
