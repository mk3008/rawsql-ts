# @rawsql-ts/mcp-server

A local Model Context Protocol server exposing ten deterministic rawsql-ts
analysis and transformation tools.

The npm package is `@rawsql-ts/mcp-server`. Installing it provides the
`rawsql-ts-mcp` executable.

## Tools

- `validate_sql`
- `inspect_query_contract`
- `analyze_query_structure`
- `analyze_column_lineage`
- `slice_query`
- `create_fixture_extraction_plan`
- `find_query_usage`
- `extract_cte_query`
- `optimize_sql_conditions`
- `format_sql`

The server does not connect to a database, execute SQL, inspect rows, or write
rewritten SQL back to project files.

## Start

```sh
pnpm dlx @rawsql-ts/mcp-server --workspace /absolute/path/to/project
```

`--workspace` may be omitted to use the current working directory. The
workspace confines SQL usage scans, DDL paths, and formatter configuration
paths.

- `validate_sql` accepts one SELECT statement plus optional inline `ddl` and
  workspace-relative `ddlPaths`. Invalid SQL is returned as structured syntax
  or schema diagnostics rather than a transport error.
- `inspect_query_contract` accepts the same static SQL and optional DDL inputs.
  It returns parameter occurrences, ordered output columns, physical tables,
  DDL-proven types, and query-proven output nullability metadata.
- `analyze_query_structure` accepts `sql`, optional inline `ddl`, optional
  workspace-relative `ddlPaths`, and optional `view: "compact" | "full"`.
  Full results include AST-free V1 structural scope selectors, parent selectors,
  direct CTE names, and fail-closed outer-reference status. Compact results do
  not include scopes or selectors. In full results, `scopeKind` is the exact
  structural kind; `kind` remains compatible with the pre-existing lineage
  scope values. `scopeCount` counts the complete structural inventory, and
  `maximumNestingDepth` follows structural parents with the root at depth 1.
- `analyze_column_lineage` accepts `sql`, required `targetColumn`, and optional
  inline `ddl`, workspace-relative `ddlPaths`, generated-SQL `format`, and
  `view: "compact" | "full"`.
- `slice_query` accepts `sql`, a required V1 structural `selector`, optional
  inline `ddl`, workspace-relative `ddlPaths`, and generated-SQL `format`.
  Callers pass a selector from `analyze_query_structure` full output for the
  same SQL. The tool does not select a scope by CTE name or choose one
  implicitly.
- `create_fixture_extraction_plan` accepts `sql`, optional inline `ddl`,
  workspace-relative `ddlPaths`, and generated-SQL `format`.
- `find_query_usage` accepts a target and optional workspace-relative
  `scopeDir`, canonical `usageKinds`, `limit`, and `summaryOnly`; it does not
  accept `ddl`.
  Allowed `usageKinds` are `from`, `subquery-from`, `cte-body-from`, `join`,
  `using`, `insert-target`, `update-target`, `delete-target`, `select`, `where`,
  `group-by`, `having`, `order-by`, `join-on`, `join-using`, `update-set`,
  `returning`, `insert-column`, `subquery`, and `cte`; the
  [`QUERY_USAGE_KINDS`](../sql-grep-core/src/query/usageKinds.ts) export is the
  canonical definition.
- `extract_cte_query` accepts `sql`, `cteName`, and optional generated-SQL
  `format`; it does not accept `ddl`.
- `optimize_sql_conditions` accepts `sql` and optional absent parameter names;
  it also accepts optional generated-SQL `format` and does not accept `ddl`.
- `format_sql` accepts one `sql` statement plus optional `format`. Omitting
  `format` uses rawsql-ts formatter defaults. It does not accept `ddl`.

`ddlPaths` accepts one workspace-relative `.sql` file or directory, or an array
of them. Directories are scanned recursively with deterministic ordering and
the same confinement and resource limits as the common DDL resolver. Inline
and path-backed DDL may be combined; each source retains its own identity.

The optional formatter input has this shape:

```json
{
  "format": {
    "configPath": "config/sql-formatter.json",
    "options": {
      "keywordCase": "upper"
    }
  }
}
```

Formatter defaults are overridden by `configPath`, then by inline `options`.
Options are strictly validated by rawsql-ts core. Outside the explicit
`format_sql` request, formatting applies only to generated artifacts: CTE
executable SQL, safe condition rewrites and their generated probes, fixture
capture SQL, lineage investigation probes, and ready query-slice SQL. Original
SQL, selectors, diagnostics, expressions, predicates, snippets, and other
evidence are never formatted. A blocked query slice has no SQL artifact to
format.

`find_query_usage` recursively scans project `.sql` files beneath its optional
`scopeDir` argument. `scopeDir` is relative to the configured workspace and
defaults to the workspace root. QuerySpec registration is not required. `.git`
and `node_modules` are skipped; generated or build directories are included
when they are inside the selected scope.

## Input boundary

Each tool accepts only the arguments shown in its MCP schema. Parameter values,
database credentials, file mutation requests, and SQL execution requests are
not part of the contract.

## Output shape

`validate_sql` returns `valid` plus structured diagnostics. Without DDL it
performs syntax validation and reports that schema validation was skipped.
With DDL it also checks known table and column references. Validation is
single-statement and static. It resolves unqualified columns only when all
direct physical-source columns are known, reports multiple proven candidates
as ambiguous, and otherwise returns a non-failing unresolved limitation.

`inspect_query_contract` returns a small DTO rather than parser AST. Duplicate
parameter occurrences and original placeholder spelling are preserved. CTEs
and derived queries are excluded from `referencedTables`; their underlying
physical tables remain visible. Unproven type and nullability fields are
omitted. A DDL `NOT NULL` fact is returned as `nullable: false` only when the
query source is not null-extended by an outer join.

SQL-producing tools return both structured evidence and clearly labeled SQL
strings. MCP serialization removes AST instances so callers do not receive
formatter-dependent SQL as an undocumented intermediate model.

`slice_query` returns `kind: "query-slice"`, `version: 1`, and an explicit
`status`. A `ready` result contains the resolved selector, scope kind,
`outerReferenceStatus: "none"`, direct and included CTE names, diagnostics,
and one generated `sql` string. A `blocked` result contains the same evidence
without `sql`, `partialSql`, or another candidate. Invalid source SQL and
selectors that are malformed, stale, absent, or ambiguous are input errors,
not blocked results.

The tool supports root, CTE, derived, scalar-subquery, EXISTS, IN-subquery, and
set-operation scopes. It re-resolves the selector on the supplied SQL, applies
the fail-closed `unresolved > correlated > none` outer-reference classification,
uses optional DDL facts only to improve ownership proof, reconstructs required
external CTEs from the core dependency analyzer, and reparses generated SQL
before returning it. Recursive CTEs, unresolved lexical ownership, multiple
lexical CTE contexts, and unsupported nested-WITH composition remain blocked.
The SQL is a standalone representation of the selected scope body; it is not a
claim that the slice is equivalent to the complete source query or that the
source query was minimized. Projection, predicate, join, grouping, ordering,
and output-column pruning are outside this contract.

`format_sql` is the explicit exception to the generated-artifact boundary: its
input SQL is formatted because the caller requested formatting directly, not
because another tool generated it. It reuses the same workspace-confined JSON
config and core-owned option validation, with precedence defaults < config <
inline options. It supports one statement and returns `SQL_FORMAT_FAILED` for
parse or formatting failures.

When `view` is omitted, structure and lineage tools return their existing full
result. Their compact views are explicit transport DTOs that retain summaries,
warnings, source leaves, concerns, diagnostics, and investigation counts while
omitting detailed scopes, lineage trees, expression chains, and probe bodies.

Usage-kind filtering and output controls are applied after the workspace scan by
sql-grep-core. `usageKinds` filters classified matches before impact aggregation;
then `limit` restricts returned matches and warnings, while `summaryOnly: true`
omits their bodies. The report's existing `display` metadata states filtered
totals, returned counts, and truncation. Omitting these controls preserves the
existing report shape.
