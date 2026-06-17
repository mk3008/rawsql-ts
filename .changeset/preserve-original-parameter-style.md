---
"rawsql-ts": patch
---

Add `parameterStyle: "original"` so formatting parsed SQL can preserve the input parameter placeholder spelling, including `:name`, `@name`, `$1`, `?`, and `${name}` forms.
