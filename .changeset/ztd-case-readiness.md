---
"@rawsql-ts/ztd-cli": patch
---

Make `ztd feature tests scaffold` generate query-local ZTD case scaffolds as explicit TODO placeholders.

The generated ZTD Vitest entrypoint now starts skipped until the case values are filled, and the placeholder case includes CLI-discovered table, input, and output hints so users and AI agents can see what still needs to be completed before enabling the test.
