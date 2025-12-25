---
"@rawsql-ts/ztd-cli": minor
---

Add optional SqlClient scaffold for tutorials

`ztd init --with-sqlclient` now generates a minimal `sql-client.ts`, providing a small SQL client boundary for tutorial and onboarding use cases.

- The scaffold is optional and intended mainly for tutorials.
- Projects with an existing database layer do not need this flag.
- Existing `sql-client.ts` files are never overwritten.

Templates and documentation were updated to explain when this option is appropriate.
Tests were added to verify file generation and non-overwrite behavior.
