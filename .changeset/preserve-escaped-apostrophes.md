---
"rawsql-ts": major
---

Preserve the spelling of parsed single-quoted strings when formatting SQL. When constructing a quoted `LiteralValue`, pass an explicit `{ isEscaped: boolean }` option. To edit a quoted value, call `setStringValue(value, { isEscaped })` in place of direct assignment. Pass `false` for plain text and `true` for text already escaped for the target SQL.
