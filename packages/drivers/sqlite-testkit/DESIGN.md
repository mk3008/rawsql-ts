# SQLite Testkit Design Notes

## Role and Boundaries
- Defines design intent for `packages/drivers/sqlite-testkit`.
- Keeps SQLite-specific execution adaptation separate from rewrite ownership in testkit-core.

## Non-Goals
- Owning parser/rewrite semantics.
- Treating SQLite storage as persistent authoritative fixture state.

## Driver Intent
- SQLite is used as execution engine for rewritten SELECT, not as authoritative mutable state.
- Driver API shape mirrors testkit-core options and diagnostics behavior.
