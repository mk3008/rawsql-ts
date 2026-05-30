---
"rawsql-ts": minor
---

Add `identifierEscapeTarget: "minimal"` to `SqlFormatter` so identifier quotes are removed only when the bare identifier is syntactically valid and semantically safe. The escape symbol remains controlled separately by `identifierEscape` (`quote`, `backtick`, `bracket`, or explicit delimiters). Reserved words, SQL special value expressions such as `current_user` and `current_timestamp`, mixed-case names, and identifiers containing spaces or punctuation remain escaped. Bare SQL special value expressions stay unquoted, while qualified references such as `table.current_user` can still be parsed as column references.
