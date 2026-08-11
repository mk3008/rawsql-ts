---
"rawsql-ts": patch
"@rawsql-ts/sql-grep-core": minor
"@rawsql-ts/investigation-core": minor
"@rawsql-ts/mcp-server": minor
---

Add six local MCP tools for query-structure analysis, column lineage, bounded fixture extraction, recursive `.sql` file usage search, CTE extraction, and safe condition optimization. The reusable investigation engine now lives in the rawsql-ts monorepo, SQL usage scans can be confined to a workspace-relative directory without QuerySpec metadata, and browser bundling correctly omits type-only runtime exports.
