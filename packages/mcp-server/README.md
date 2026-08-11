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
workspace is used only by `find_query_usage`.

- `analyze_query_structure` accepts `sql` and optional `ddl`.
- `analyze_column_lineage` accepts `sql`, required `targetColumn`, and optional
  `ddl`.
- `create_fixture_extraction_plan` accepts `sql` and optional `ddl`.
- `find_query_usage` accepts a target and an optional workspace-relative
  `scopeDir`; it does not accept `ddl`.
- `extract_cte_query` accepts `sql` and `cteName`; it does not accept `ddl`.
- `optimize_sql_conditions` accepts `sql` and optional absent parameter names;
  it does not accept `ddl`.

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
