---
"rawsql-ts": patch
---

Fix PostgreSQL empty array constructor parsing inside function arguments so `array[]::text[]` formats as an array cast instead of a quoted identifier cast.

Add `sourceAliasStyle: "implicit"` formatting support so callers can avoid inserting optional `AS` keywords for `FROM`/`JOIN` source aliases when they need token-stable formatting.

Add `orderByDefaultDirectionStyle: "explicit"` formatting support so callers can preserve explicit `ASC` directions during token-stable formatting.
