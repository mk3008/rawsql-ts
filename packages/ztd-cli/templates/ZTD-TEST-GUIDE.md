# ZTD Test Guide

Fixtures are generated from `sql/ddl/` definitions and reused by `pg-testkit`.
Always import table types from `tests/ztd-row-map.generated.ts` before writing scenarios, and rerun `npx ztd ztd-config` whenever the schema changes.
