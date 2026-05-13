# rawsql-ts

![npm version](https://img.shields.io/npm/v/rawsql-ts)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A high-performance SQL parser and AST transformer written in TypeScript. Parse raw SQL into objects, manipulate query structures programmatically, and generate optimized output -- all with zero dependencies.

> [!NOTE]
> This library is currently in beta. The API may change until the v1.0 release.

## Features

- **Zero dependencies** -- fully self-contained and lightweight
- **High-performance** -- significantly faster than node-sql-parser in our parse-only benchmarks
- **Browser ready** -- works in browsers via CDN (unpkg / jsdelivr)
- **Dynamic query building** -- filtering, sorting, pagination, JSON serialization, and truthful optional-condition pruning
- **CTE management** -- add, remove, and manipulate CTEs programmatically
- **Schema validation** -- static query validation against your database schema
- **Full TypeScript support** -- type-safe APIs throughout

## Installation

```bash
npm install rawsql-ts
````

Or use directly in the browser via CDN:

```html
<script type="module">
  import { parse } from "https://unpkg.com/rawsql-ts/dist/esm/index.min.js";
</script>
```

## Quick Start

```typescript
import { DynamicQueryBuilder, SqlFormatter } from "rawsql-ts";

const baseSql = `
  SELECT id, name, email, status, created_at
  FROM users
  WHERE active = true
    AND (:status IS NULL OR status = :status)
`;

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: { status: "premium" },
  sort: { created_at: { desc: true }, name: { asc: true } },
  paging: { page: 2, pageSize: 10 },
  optionalConditionParameters: { status: "premium" },
});

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);
```

## SSSQL for Optional Conditions

When the request is "add an optional filter", rawsql-ts can keep the SQL source truthful instead of pushing you toward string-built `WHERE` assembly.

```typescript
const sql = `
  SELECT p.product_id, p.product_name
  FROM products p
  WHERE (:brand_name IS NULL OR p.brand_name = :brand_name)
    AND (:category_name IS NULL OR EXISTS (
      SELECT 1
      FROM product_categories pc
      JOIN categories c
        ON c.category_id = pc.category_id
      WHERE pc.product_id = p.product_id
        AND c.category_name = :category_name
    ))
`;

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(sql, {
  optionalConditionParameters: {
    brand_name: null,
    category_name: "shoes",
  },
});
```

This SSSQL style keeps optionality visible in the SQL itself and lets rawsql-ts prune only the explicitly targeted absent branches.
Use `DynamicQueryBuilder` filter injection first for optional predicates on columns that already exist in the current query. Reach for SSSQL when the optional filter needs a table or branch that is not already part of the query graph.

Read more:

- [What Is SSSQL?](../../docs/guide/sssql-overview.md)
- [SSSQL Optional Branch Pruning MVP](../../docs/guide/sssql-optional-branch-pruning.md)
- [Querybuilding Recipes](../../docs/guide/querybuilding-recipes.md)

## API Overview

### Parsing

| Class               | Description                      | Docs                                               |
| ------------------- | -------------------------------- | -------------------------------------------------- |
| `SelectQueryParser` | Parse SELECT statements into AST | [Guide](../../docs/guide/getting-started.md)       |
| `InsertQueryParser` | Parse INSERT statements into AST | [API](../../docs/api/classes/InsertQueryParser.md) |
| `UpdateQueryParser` | Parse UPDATE statements into AST | [API](../../docs/api/classes/UpdateQueryParser.md) |
| `DeleteQueryParser` | Parse DELETE statements into AST | [API](../../docs/api/classes/DeleteQueryParser.md) |

### Query Building

| Class                      | Description                                                    | Docs                                                      |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `DynamicQueryBuilder`      | All-in-one filtering, sorting, pagination, serialization, and SSSQL optional-condition pruning | [Guide](../../docs/guide/querybuilding-recipes.md)        |
| `QueryBuilder`             | Convert SELECT queries into INSERT / UPDATE statements         | [API](../../docs/api/classes/QueryBuilder.md)             |
| `PostgresJsonQueryBuilder` | Transform relational queries into hierarchical JSON structures | [API](../../docs/api/classes/PostgresJsonQueryBuilder.md) |

### Injection

| Class                   | Description                                                    | Docs                                                   |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| `SqlParamInjector`      | Dynamic WHERE condition injection from parameters              | [API](../../docs/api/classes/SqlParamInjector.md)      |
| `SqlSortInjector`       | Dynamic ORDER BY injection with ASC/DESC and NULLS positioning | [API](../../docs/api/classes/SqlSortInjector.md)       |
| `SqlPaginationInjector` | Dynamic LIMIT/OFFSET injection with page-based support         | [API](../../docs/api/classes/SqlPaginationInjector.md) |

### Formatting

| Class          | Description                                                           | Docs                                            |
| -------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| `SqlFormatter` | SQL formatting with indentation, keyword casing, and comment handling | [Guide](../../docs/guide/formatting-recipes.md) |

### Analysis

| Class                       | Description                                           | Docs                                                       |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `SelectableColumnCollector` | Extract column references for dependency analysis     | [API](../../docs/api/classes/SelectableColumnCollector.md) |
| `SqlSchemaValidator`        | Validate queries against a database schema definition | [API](../../docs/api/classes/SqlSchemaValidator.md)        |
| `QueryFlowDiagramGenerator` | Generate Mermaid flow diagrams from SQL queries       | [API](../../docs/api/classes/QueryFlowDiagramGenerator.md) |

### Schema & CTE

| Class               | Description                                                | Docs                                               |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `SchemaManager`     | Unified schema definition with type-safe format conversion | [API](../../docs/api/classes/SchemaManager.md)     |
| `SimpleSelectQuery` | Programmatic CTE management (add, remove, replace)         | [API](../../docs/api/classes/SimpleSelectQuery.md) |

## Benchmarks

This section reports **parse-only** benchmark results for the SQL parser. It measures AST parsing time, not SQL formatting time.

For readability, workloads are described by approximate SQL line counts, with token counts included in parentheses for technical precision. Parser cost is driven more directly by token volume than by formatting style.

Across these workloads, parsing remains fast and stable, performance remains practical, and no performance cliff was observed up to the very large case. `sqlite3-parser` is faster on SQLite-compatible inputs, as expected for a SQLite-focused parser, but rawsql-ts remains substantially faster than `node-sql-parser` while preserving its broader AST, comment, formatting, and transformation surface.

![Parser Scaling Chart](https://quickchart.io/chart?c={type:'line',data:{labels:['Small%208%20lines','Medium%2012%20lines','Large%2020%20lines','Mid-large%20400-500%20lines','Very%20large%201,000%2B%20lines'],datasets:[{label:'rawsql-ts',data:[0.053,0.094,0.175,4.462,9.715],borderColor:'rgba(54,162,235,1)',backgroundColor:'rgba(54,162,235,0.15)',fill:false,tension:0.2},{label:'node-sql-parser',data:[0.646,0.874,1.954,31.672,79.583],borderColor:'rgba(255,206,86,1)',backgroundColor:'rgba(255,206,86,0.15)',fill:false,tension:0.2},{label:'sqlite3-parser',data:[0.015,0.026,0.062,null,null],borderColor:'rgba(75,192,192,1)',backgroundColor:'rgba(75,192,192,0.15)',fill:false,tension:0.2}]},options:{plugins:{legend:{labels:{color:'black'}}},elements:{point:{radius:3}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=760&height=420)

| Workload | rawsql-ts | node-sql-parser | sqlite3-parser |
|----------|----------:|----------------:|----------------:|
| Small query, about 8 lines (70 tokens) | 0.053 ms | 0.646 ms (12.2x) | 0.015 ms |
| Medium query, about 12 lines (140 tokens) | 0.094 ms | 0.874 ms (9.3x) | 0.026 ms |
| Large query, about 20 lines (230 tokens) | 0.175 ms | 1.954 ms (11.2x) | 0.062 ms |
| Mid-large query, about 400-500 lines (5,000 tokens) | 4.462 ms | 31.672 ms (7.1x) | n/a |
| Very large query, about 1,000+ lines (~12,000 tokens) | 9.715 ms | 79.583 ms (8.2x) | n/a |

> Benchmarked on AMD Ryzen 7 7800X3D / Node.js v22.14.0 / node-sql-parser 5.4.0 / sqlite3-parser 0.7.1 (2026-05-13). The mid-large and very large cases use benchmark-only analytics-style SQL workloads that represent practical long-query classes rather than formatter scenarios. `sqlite3-parser` is reported as `n/a` for cases containing PostgreSQL-style typed literals that it does not accept. See [benchmark details](../../docs/bench/parse-benchmark.md) and [sqlite3-parser comparison details](../../docs/bench/sqlite3-parser-comparison.md) for full results.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT

