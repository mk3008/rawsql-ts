---
"@rawsql-ts/sql-contract": minor
"@rawsql-ts/ztd-cli": minor
---

Add generated row mapper support for RFBA scaffolds and a compiled column-map projector for sql-contract hot paths.

New RFBA query scaffolds now include a machine-owned `generated/row-mapper.ts` file and use it from the query boundary by default, keeping the public boundary thin while avoiding runtime mapper overhead for standard scaffold output. Generated mapper files include a machine-owned header and are synchronized by `ztd feature generated-mapper generate`; `ztd feature generated-mapper check` fails on drift and prints the regeneration command for CI/test workflows.

sql-contract now exposes `compileColumnProjector` and `compileColumnMapRowsMapper` so applications can keep explicit column contracts while preparing fast row projection functions at startup. `compileColumnProjector` now rejects non-string column map values instead of silently dropping them.
