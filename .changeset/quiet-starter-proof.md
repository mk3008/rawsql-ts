---
"@rawsql-ts/ztd-cli": patch
---

Tighten the starter first-run experience by keeping the generated smoke QuerySpec typecheckable, wrapping aggregate Postgres connection failures with concise recovery steps, and extending publish artifact verification to run starter typecheck, DB-free smoke tests, and ztd-config before release.
