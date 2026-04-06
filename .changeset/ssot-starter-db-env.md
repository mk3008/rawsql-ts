---
"@rawsql-ts/ztd-cli": patch
---

The starter scaffold now treats `.env` as the single source of truth for database connection settings. `compose.yaml` reads the DB host, port, name, user, and password from `.env`, and the generated Vitest setup derives `ZTD_TEST_DATABASE_URL` from those values. If a preexisting `ZTD_TEST_DATABASE_URL` conflicts with the starter DB settings, `ztd` now fails fast instead of silently choosing one source.
