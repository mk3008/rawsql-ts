---
"rawsql-ts": minor
"@rawsql-ts/investigation-core": minor
"@rawsql-ts/mcp-server": minor
---

Add versioned structural selectors for parser-backed query scopes, explicit AST resolution outcomes, and full query-structure metadata for parent scopes, direct CTE references, and fail-closed outer-reference classification. Existing lineage scope IDs and legacy-compatible `kind` values remain unchanged; consumers should use the new `scopeKind` field when switching over the exact structural kinds `root`, `exists`, and `in_subquery`.

`QueryStructureSummaryV1.scopeCount` now counts the complete parser-backed structural scope inventory, including the root, predicate subqueries, and set-operation scopes. `maximumNestingDepth` now follows structural parent selectors and counts the root as depth 1, so both summary values can change for the same SQL compared with the previous lineage-only inventory. Compact MCP output remains selector-free, and no query-slicing tool is added.
