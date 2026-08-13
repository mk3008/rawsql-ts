# MCP Product Decision — 2026-08

## Decision

Status: `done / current-10-tools-sufficient`

Keep the current ten tools. There is no current consolidation candidate and no
evidence-based reason to add an eleventh tool. This is the August 2026 Product
Gate judgment and may be revisited when new product evidence exists.

The supporting observations and final main verification are kept separately in
[MCP Product Gate Evidence — 2026-08](./mcp-product-gate-2026-08.md).

## Product position

The rawsql-ts MCP server is for local, static, read-only SQL investigation. It
does not connect to a database, execute SQL, inspect data, or mutate project SQL
files.

## Catalog judgment

- Keep: 10
- Questionable: 0
- Consolidation candidates: 0

`slice_query` has independent value as a safe standalone representation of an
explicit parser-backed query scope. It is not a query minimizer. Correlation,
unresolved ownership, and unsafe lexical CTE context must remain fail-closed.

`extract_cte_query` remains useful when the CTE name is already known. Its
one-call named-CTE workflow is meaningfully shorter than discovering a selector
and then slicing it.

Compact and full views serve different jobs. Use compact for overview and
triage; request full only when selectors or detailed evidence are needed.

## Recommended workflows

Initial investigation:

```text
compact
-> full only when needed
```

Scope investigation:

```text
analyze_query_structure(full)
-> selector
-> slice_query
```

Known CTE name:

```text
extract_cte_query
```

Wrong-value investigation:

```text
inspect_query_contract
-> analyze_column_lineage
-> structure / slice when needed
```

## Deferred Phase 4C

Output-column slicing is deferred due to insufficient product evidence. This
is not a permanent judgment that the capability is unnecessary.

Reconsider it only after multiple independent real investigations demonstrate
that `analyze_column_lineage` plus `slice_query` cannot complete the task, and
that the concrete bottleneck is the absence of executable SQL for only the
target output. One case is not sufficient.

## Catalog expansion condition

Consider another tool only when all of the following are demonstrated:

- the current ten tools cannot complete the workflow;
- adding an option to an existing tool would be unnatural;
- the proposed capability has independent value across multiple workflows.

Do not expand, rename, remove, or consolidate the catalog solely because a new
capability can be built.
