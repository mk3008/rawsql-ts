---
"rawsql-ts": patch
---

### Normalize ZTD fixture casts

- Fixture casts now translate Postgres serial pseudo-types (serial, bigserial, smallserial, etc.) into their real integer targets, so generated SQL never attempts to cast into invalid pseudo-types.
