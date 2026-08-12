# @rawsql-ts/investigation-core

Deterministic static SQL investigation operations built on rawsql-ts.

```sh
pnpm add @rawsql-ts/investigation-core
```

## Capabilities

- Analyze query structure, including physical tables, CTEs, derived queries,
  nesting, predicate subqueries, and row-set-changing operations. Full results
  include V1 structural selectors, structural parents, direct CTE references,
  and fail-closed `none` / `correlated` / `unresolved` outer-reference status.
- Analyze one uniquely named final output column and produce lineage evidence.
- Produce a standalone representation of one structural query scope only when
  selector resolution, outer-reference analysis, lexical CTE reconstruction,
  and final parsing prove it safe. Unproven scopes return a blocked result with
  no candidate SQL.
- Generate a value-free fixture capture plan when SQL and supplied DDL prove a
  bounded extraction boundary.

The package does not connect to a database, execute SQL, inspect rows, or infer
runtime parameter values.

## Usage

```ts
import { analyzeQueryStructure } from '@rawsql-ts/investigation-core';

const result = analyzeQueryStructure({
  sql: 'select customer_id, sum(amount) from orders group by customer_id',
});
```

Safe query slicing uses the V1 selector returned by full structure analysis:

```ts
import { sliceQueryScope } from '@rawsql-ts/investigation-core';

const slice = sliceQueryScope({
  sql: 'select * from (select id from orders) picked',
  selector: {
    path: [
      { kind: 'root' },
      { index: 0, kind: 'source_subquery', source: 'from' },
    ],
    version: 1,
  },
});
```

Public operations return structured models. Generated SQL remains an explicitly
labeled artifact inside those models rather than the only transformation
result. To expose these operations through MCP, see
[`@rawsql-ts/mcp-server`](https://github.com/mk3008/rawsql-ts/tree/main/packages/mcp-server).

Scope selectors identify a semantic location in the same parsed SQL, not a
persistent identity across SQL edits. Parsed AST objects remain internal to the
analysis DTO; callers that need AST resolution can use rawsql-ts
`QueryScopeCollector` and `resolveQueryScope` directly.

API output shape review: query-structure DTOs expose only versioned selectors
and static metadata, while the reusable core resolver retains AST identity and
does not introduce an AST-to-SQL-to-AST round trip. The lineage-scope-to-AST
identity map remains internal and non-serialized; it does not change existing
SQL-bearing result fields or add generated SQL.

API output shape review: this contract hardening preserves every existing SQL
output and keeps parsed query identities internal.

API output shape review: query slicing adds a separate V1 ready/blocked DTO.
Only ready results expose one generated `sql` field; blocked results expose
selector and diagnostic evidence without candidate SQL. Parsed scope and CTE
AST identities remain internal. Existing analysis and extraction DTOs are
unchanged.
