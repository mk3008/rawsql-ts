Goal (including success criteria):
- Add optional `returning` support to `@rawsql-ts/sql-contract` writer helpers (`insert`, `update`, `remove`) so SQL output can include a declarative `RETURNING` clause while preserving deterministic placeholder order, no inference, and without affecting params.
- Success criteria: writer options expose `returning`, generated SQL appends `RETURNING` correctly, validation/tests cover identifiers (including unicode handling), `meta` reflects returning hints, and no existing tests regress.
- Enforce a runtime guard so callers passing `returning: 'all' | string[]` cannot accidentally hand in any other type—reject non-array values with a clear message before sorting.

Constraints / Assumptions:
- Replies must remain in Japanese; documentation and code comments must stay English.
- Writer focuses on SQL generation only; execution/emulation/capability concerns belong elsewhere.
- `ztd/ddl` remains off-limits for this work.

Key decisions:
- Keep writer purely declarative: no runtime inference, no SELECT emulation, no DB branching.
- Normalize and validate identifiers (including `returning` column names) using existing rules, with unicode requiring `allowUnsafeIdentifiers`.
- Return meta information only when `returning` is provided; parameter ordering and placeholder styles stay unaffected.

State:
- Returning option implemented for writer, tests updated accordingly, README/AGENTS mention runtime expectation, and the package build/tests ran successfully.
- Writer helpers now include richer JSDoc, covering the `returning` behavior and the extended documentation surface requested for AI readers.
- Added a Changeset entry documenting the returning option release impact.
- Guard added to reject non-array `returning` inputs, test updated, and dist rebuilt; targeted writer tests now pass.
- README rewrite performed and its claims checked against the mapper/writer implementation for consistency.

Done:
- Implemented returning clause handling and metadata for the writer functions.
- Extended writer tests to cover returning semantics, validation, and placeholder styles plus reordered keys.
- Documented the returning option and the fact that unsupported databases may error at execution time.
- Ran `pnpm --filter @rawsql-ts/sql-contract build` and `pnpm --filter @rawsql-ts/sql-contract test`.

Now:
- Guard and unit test changes merged, dist rebuilt, and writer-specific tests pass.

Next:
- Capture review outcome in documentation/changeset as needed and rerun the full workspace test suite once existing integration flakiness (mssql mapper, ztd-config snapshot) is resolved.

Open questions (mark as UNCONFIRMED if needed):
- None.

Working set (files, ids, commands):
```
CONTINUITY.md
packages/sql-contract/src/writer/index.ts
packages/sql-contract/tests/writer/writer-core.test.ts
packages/sql-contract/README.md
packages/sql-contract/AGENTS.md
```
