---
'rawsql-ts': patch
---

Handle Postgres table functions (e.g. unnest) that declare WITH ORDINALITY when appearing in FROM sources so the parser, AST, formatter, and docs all expose the flag.
