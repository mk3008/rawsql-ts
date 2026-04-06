---
"@rawsql-ts/ztd-cli": patch
---

Fix starter scaffolds so the Vitest setup derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`, which keeps the DB-backed smoke test aligned with the compose port even if an older localhost:5432 URL is still present. Add a regression test for the generated setup file so the port override stays authoritative.
