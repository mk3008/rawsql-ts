# writer-core AGENT Instructions

## Mission
- Keep the CUD surface area as small as possible: emit `{ sql, params }` for insert/update/remove using only a table name and plain value record.
- Preserve ZTD principles by refusing any schema DTOs, row maps, or DDL DSL hints inside this package.

## Do Not
- Do not introduce DB models, entities, or derived column definitions.
- Do not import RowMap, Schema, or any DDL metadata from other packages.
- Do not invent a TypeScript DSL for tables/columns, query builders, or SQL parsers.
- Do not guess WHERE clauses, JOINs, diff checking, or repository abstractions.
- Do not add type-safe schema inference or automatic column mapping.
- WHERE clauses are limited to equality-only AND lists keyed by caller-provided objects; no builder functions, OR, IN, or comparison operators are allowed.
- Table and column identifiers are assumed valid constants; user input must never be used as an identifier because writer-core never validates identifiers by design.

## Tempting conveniences that are forbidden
- Adding a `writerCore.where()` builder that promised to merge filters automatically is too close to a query builder; refuse it.
- Hiding table or column names behind exported constants or helpers would reintroduce schema awareness; refuse that.
- Introducing a WHERE helper that builds comparisons beyond simple ANDed equality is too close to a query builder and must be refused.
- Placeholders are emitted via `formatPlaceholder(index)`; every SQL fragment should rely on that helper so the `$1, $2, ...` sequence stays consistent. Named or positional variations remain unimplemented as future options.

## Why writer-core is a core package
- It sits between user code and the DB to keep CUD repetitive syntax manageable without lifting schema into application code.
- It protects the rawsql-ts boundary by showing SQL + params instead of abstracting them away, so the planner/test fixtures stay authoritative.

## Tone and future extensions
- Speak to both humans and AI: mention when you add tools or tests, explain why the naive, more convenient idea was rejected.
- Explicitly block future feature creep: refuse to become an ORM, DSL generator, or repository adapter. If a new idea feels like a schema helper, decline it.
