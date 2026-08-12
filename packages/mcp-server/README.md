# @rawsql-ts/mcp-server

A local Model Context Protocol server exposing nine deterministic rawsql-ts
analysis and transformation tools.

The npm package is `@rawsql-ts/mcp-server`. Installing it provides the
`rawsql-ts-mcp` executable.

## Tools

- `validate_sql`
- `inspect_query_contract`
- `analyze_query_structure`
- `analyze_column_lineage`
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
capture SQL, and lineage investigation probes. Original SQL, expressions,
predicates, snippets, and other evidence are never formatted.

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
