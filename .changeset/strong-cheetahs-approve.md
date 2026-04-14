---
"@rawsql-ts/ztd-cli": patch
---

Make the starter ZTD helper a thin adapter over library mode execution and return machine-checkable run evidence.

The generated ZTD harness now asserts `mode=ztd` and `physicalSetupUsed=false`, supports opt-in SQL trace output, and is covered by starter acceptance that runs `vitest` before schema setup in generated-project verification.
