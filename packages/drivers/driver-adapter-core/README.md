# @rawsql-ts/driver-adapter-core

Thin SQL driver adapter primitives for SQL-first rawsql-ts projects.

This package is not an ORM and does not build business SQL. It keeps SQL files reviewable by allowing named parameters in source SQL, then compiles those parameters to the placeholder style required by the selected database driver.

Driver-specific packages should use names that identify the concrete driver implementation, for example:

- `@rawsql-ts/driver-adapter-node-postgres`
- `@rawsql-ts/driver-adapter-postgres-js`
- `@rawsql-ts/driver-adapter-mysql2`

The core package intentionally stays driver-neutral.
