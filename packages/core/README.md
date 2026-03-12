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

const baseSql = "SELECT id, name, email, created_at FROM users WHERE active = true";

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: { status: "premium", created_at: { ">": "2024-01-01" } },
  sort: { created_at: { desc: true }, name: { asc: true } },
  paging: { page: 2, pageSize: 10 },
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

Across these workloads, parsing remains fast and stable, performance remains practical, and no performance cliff was observed up to the very large case.

![Parser Scaling Chart](https://quickchart.io/chart?c={type:'line',data:{labels:['Small%208%20lines','Medium%2012%20lines','Large%2020%20lines','Mid-large%20400-500%20lines','Very%20large%201,000%2B%20lines'],datasets:[{label:'rawsql-ts',data:[0.04,0.08,0.168,4.438,8.173],borderColor:'rgba(54,162,235,1)',backgroundColor:'rgba(54,162,235,0.15)',fill:false,tension:0.2},{label:'node-sql-parser',data:[0.687,0.744,1.56,36.52,54.775],borderColor:'rgba(255,206,86,1)',backgroundColor:'rgba(255,206,86,0.15)',fill:false,tension:0.2}]},options:{plugins:{legend:{labels:{color:'black'}}},elements:{point:{radius:3}},scales:{x:{ticks:{color:'black'}},y:{ticks:{color:'black'}}},backgroundColor:'white'}}&width=760&height=420)

| Workload | rawsql-ts | node-sql-parser |
|----------|----------:|----------------:|
| Small query, about 8 lines (70 tokens) | 0.040 ms | 0.687 ms (17.0x) |
| Medium query, about 12 lines (140 tokens) | 0.080 ms | 0.744 ms (9.3x) |
| Large query, about 20 lines (230 tokens) | 0.168 ms | 1.560 ms (9.3x) |
| Mid-large query, about 400-500 lines (5,000 tokens) | 4.438 ms | 36.520 ms (8.2x) |
| Very large query, about 1,000+ lines (~12,000 tokens) | 8.173 ms | 54.775 ms (6.7x) |

> Benchmarked on AMD Ryzen 7 7800X3D / Node.js v22.14.0 / node-sql-parser 5.4.0 (2026-03-06). The mid-large and very large cases use benchmark-only analytics-style SQL workloads that represent practical long-query classes rather than formatter scenarios. See [benchmark details](../../docs/bench/parse-benchmark.md) for full results.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
