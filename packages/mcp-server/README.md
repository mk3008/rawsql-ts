# @rawsql-ts/mcp-server

A local Model Context Protocol server exposing six deterministic rawsql-ts
analysis and transformation tools.

The npm package is `@rawsql-ts/mcp-server`. Installing it provides the
`rawsql-ts-mcp` executable.

## Tools

- `analyze_query_structure`
- `analyze_column_lineage`
- `create_fixture_extraction_plan`
- `find_query_usage`
- `extract_cte_query`
- `optimize_sql_conditions`

The server does not connect to a database, execute SQL, inspect rows, or write
rewritten SQL back to project files.

## Start

```sh
pnpm dlx @rawsql-ts/mcp-server --workspace /absolute/path/to/project
```

`--workspace` may be omitted to use the current working directory. The
workspace confines SQL usage scans, DDL paths, and formatter configuration
paths.

- `analyze_query_structure` accepts `sql`, optional inline `ddl`, optional
  workspace-relative `ddlPaths`, and optional `view: "compact" | "full"`.
- `analyze_column_lineage` accepts `sql`, required `targetColumn`, and optional
  inline `ddl`, workspace-relative `ddlPaths`, generated-SQL `format`, and
  `view: "compact" | "full"`.
- `create_fixture_extraction_plan` accepts `sql`, optional inline `ddl`,
  workspace-relative `ddlPaths`, and generated-SQL `format`.
- `find_query_usage` accepts a target and an optional workspace-relative
  `scopeDir`, `limit`, and `summaryOnly`; it does not accept `ddl`.
- `extract_cte_query` accepts `sql`, `cteName`, and optional generated-SQL
  `format`; it does not accept `ddl`.
- `optimize_sql_conditions` accepts `sql` and optional absent parameter names;
  it also accepts optional generated-SQL `format` and does not accept `ddl`.

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
Options are strictly validated by rawsql-ts core. Formatting applies only to
explicit generated artifacts: CTE executable SQL, safe condition rewrites and
their generated probes, fixture capture SQL, and lineage investigation probes.
Original SQL, expressions, predicates, snippets, and other evidence are never
formatted.

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

SQL-producing tools return both structured evidence and clearly labeled SQL
strings. MCP serialization removes AST instances so callers do not receive
formatter-dependent SQL as an undocumented intermediate model.

When `view` is omitted, structure and lineage tools return their existing full
result. Their compact views are explicit transport DTOs that retain summaries,
warnings, source leaves, concerns, diagnostics, and investigation counts while
omitting detailed scopes, lineage trees, expression chains, and probe bodies.

Usage output controls are applied after the workspace scan by sql-grep-core.
`limit` restricts returned matches and warnings; `summaryOnly: true` omits their
bodies. The report's existing `display` metadata states totals, returned counts,
and truncation. Omitting both controls preserves the existing report shape.
