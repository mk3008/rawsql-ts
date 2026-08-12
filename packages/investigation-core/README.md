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
