---
"rawsql-ts": patch
---

Add `columnAliasStyle` to control whether select-list aliases print with an explicit `AS` keyword. The new option accepts `"explicit"` and `"omit"` while preserving compatibility with the legacy `"as"` and `"implicit"` values, and the formatter keeps `AS` when comments are attached to that keyword so comment output remains safe.
