# @rawsql-ts/ztd-cli

## 0.16.0

### Minor Changes

- [#411](https://github.com/mk3008/rawsql-ts/pull/411) [`84ec3a0`](https://github.com/mk3008/rawsql-ts/commit/84ec3a0c5f3e16463c1eee532fc9570bf1bcff93) Thanks [@mk3008](https://github.com/mk3008)! - Document that the CLI templates treat ztd/ddl as the only authoritative source, keep optional references purely informational, and ship the mapper/writer sample with its supporting tests.

### Patch Changes

- Updated dependencies [[`1ad78c5`](https://github.com/mk3008/rawsql-ts/commit/1ad78c5430b2ac24e0fb8fe6fb6ecf913e9b9e54), [`857a3c3`](https://github.com/mk3008/rawsql-ts/commit/857a3c3f21e32610024aa51f636841f9ff9e4ce4), [`84ec3a0`](https://github.com/mk3008/rawsql-ts/commit/84ec3a0c5f3e16463c1eee532fc9570bf1bcff93), [`2361f3c`](https://github.com/mk3008/rawsql-ts/commit/2361f3cbdf7589984bbbe7779ffb5d8129ff3804), [`9c05224`](https://github.com/mk3008/rawsql-ts/commit/9c052243a8005b8882e88f50b7d469ac7c55b24e), [`fc7a80e`](https://github.com/mk3008/rawsql-ts/commit/fc7a80e237850dc3c5f06dd7c8ad5472af1e3dc8), [`e38df03`](https://github.com/mk3008/rawsql-ts/commit/e38df035cc8301b24a4fdfaab9d1cbbaa9d95c0a), [`f957e21`](https://github.com/mk3008/rawsql-ts/commit/f957e219ab5f1f27df2bc771fc25032ccf35f226), [`ba24150`](https://github.com/mk3008/rawsql-ts/commit/ba24150112a08ae5e80fc43533f7c5d47d8e3a81)]:
  - rawsql-ts@0.16.0
  - @rawsql-ts/testkit-postgres@0.15.1
  - @rawsql-ts/adapter-node-pg@0.15.1
  - @rawsql-ts/testkit-core@0.15.1

## 0.15.0

### Patch Changes

- [#387](https://github.com/mk3008/rawsql-ts/pull/387) [`95525f7`](https://github.com/mk3008/rawsql-ts/commit/95525f72f37576f0ef4e78bf77f8681644311f82) Thanks [@mk3008](https://github.com/mk3008)! - - ztd init now writes the tests/AGENTS.md guidance next to the generated tests layout so the CLI includes the latest testing rules without manual steps.
  - Expanded the AGENTS templates to spell out the required validation and testing expectations for general and tests directories.

- [#391](https://github.com/mk3008/rawsql-ts/pull/391) [`4e14a23`](https://github.com/mk3008/rawsql-ts/commit/4e14a23b405c1ba729229330baf725d09837aca2) Thanks [@mk3008](https://github.com/mk3008)! - Add deterministic ztd lint integration coverage and relax parser/default-value assertions.

- Updated dependencies [[`8fc296a`](https://github.com/mk3008/rawsql-ts/commit/8fc296a24f1dc8190c3561bc265f5b32d537eab3), [`ee41f6d`](https://github.com/mk3008/rawsql-ts/commit/ee41f6d270c8174f0c6128ece3f3abd55a726f3d), [`45c55bd`](https://github.com/mk3008/rawsql-ts/commit/45c55bd58f0e1b969ce7bcc6cc35d53d2248ebdd), [`efc6e3f`](https://github.com/mk3008/rawsql-ts/commit/efc6e3fd2c1a9dec3bc54ed446101ed53191fea3)]:
  - @rawsql-ts/testkit-core@0.15.0
  - rawsql-ts@0.15.0
  - @rawsql-ts/testkit-postgres@0.15.0
  - @rawsql-ts/adapter-node-pg@0.15.0

## 0.14.4

### Patch Changes

- [#380](https://github.com/mk3008/rawsql-ts/pull/380) [`89c5f0d`](https://github.com/mk3008/rawsql-ts/commit/89c5f0d1bac9d7801401e145ee096c811d9ac077) Thanks [@mk3008](https://github.com/mk3008)! - Improve Windows package manager spawning during `ztd init` so pnpm `.cmd` shims resolve reliably.

- Updated dependencies []:
  - rawsql-ts@0.14.4
  - @rawsql-ts/testkit-core@0.14.4

## 0.14.3

### Patch Changes

- [#376](https://github.com/mk3008/rawsql-ts/pull/376) [`5a11604`](https://github.com/mk3008/rawsql-ts/commit/5a11604a6f2fd166156762c621874f35d3e26c46) Thanks [@mk3008](https://github.com/mk3008)! - Clarify ZTD template guidance for defaults, test rules, and protected directories.

- Updated dependencies [[`1cfcc2a`](https://github.com/mk3008/rawsql-ts/commit/1cfcc2ab7502b9f01f4ba53d8e8540b8ca40e3d7)]:
  - rawsql-ts@0.14.3
  - @rawsql-ts/testkit-core@0.14.3

## 0.14.2

### Patch Changes

- [#374](https://github.com/mk3008/rawsql-ts/pull/374) [`9201657`](https://github.com/mk3008/rawsql-ts/commit/920165791046546db3b3e0f5fe25313ea332e66c) Thanks [@mk3008](https://github.com/mk3008)! - Improve Windows package manager resolution during `ztd init` dependency installation.

- Updated dependencies []:
  - rawsql-ts@0.14.2
  - @rawsql-ts/testkit-core@0.14.2

## 0.14.1

### Patch Changes

- Updated dependencies [[`0746dce`](https://github.com/mk3008/rawsql-ts/commit/0746dceb58ae2270feab896d1f1a2caf64ec338f)]:
  - @rawsql-ts/testkit-core@0.14.1
  - rawsql-ts@0.14.1

## 0.14.0

### Minor Changes

- [#364](https://github.com/mk3008/rawsql-ts/pull/364) [`18e8ef2`](https://github.com/mk3008/rawsql-ts/commit/18e8ef20ed1c2147e15f807eb91c0f61eb5481ae) Thanks [@mk3008](https://github.com/mk3008)! - Add DDL integrity linting with configurable strict/warn/off handling across fixture loading and ztd-config generation.

- [#324](https://github.com/mk3008/rawsql-ts/pull/324) [`04bd81e`](https://github.com/mk3008/rawsql-ts/commit/04bd81e8a32aec0eb0b601599b157612dd342f77) Thanks [@mk3008](https://github.com/mk3008)! - Add optional SqlClient scaffold for tutorials

  `ztd init --with-sqlclient` now generates a minimal `sql-client.ts`, providing a small SQL client boundary for tutorial and onboarding use cases.
  - The scaffold is optional and intended mainly for tutorials.
  - Projects with an existing database layer do not need this flag.
  - Existing `sql-client.ts` files are never overwritten.

  Templates and documentation were updated to explain when this option is appropriate.
  Tests were added to verify file generation and non-overwrite behavior.

- [`e9720a5`](https://github.com/mk3008/rawsql-ts/commit/e9720a56da28120eb4cac2c1c2586d7d737a8c7c) Thanks [@mk3008](https://github.com/mk3008)! - Add optional ZTD test profiling logs for connection, setup, query timing, and teardown.

### Patch Changes

- [#332](https://github.com/mk3008/rawsql-ts/pull/332) [`0ee677c`](https://github.com/mk3008/rawsql-ts/commit/0ee677cad032b36bff4834603efdfda037b2b743) Thanks [@mk3008](https://github.com/mk3008)! - ## Benchmark comparison refresh
  - Traditional and ZTD now execute the same repository implementation, but Traditional still runs migration/seed/cleanup around each call while ZTD rewrites that query into fixtures.
  - The benchmark outputs now surface the total SQL count and DB execution time for both workflows, along with the rewrite and fixture timing that explains why ZTD issues fewer statements.

- [#318](https://github.com/mk3008/rawsql-ts/pull/318) [`f5ea0f8`](https://github.com/mk3008/rawsql-ts/commit/f5ea0f85727d99c281f4719c9f6c1445636f6d93) Thanks [@mk3008](https://github.com/mk3008)! - Add SQL rewrite logging to generated pg-testkit client
  - Generated `tests/support/testkit-client.ts` can emit structured logs showing the SQL before and after pg-testkit rewrites it.
  - Logging can be enabled via `ZTD_SQL_LOG` and can optionally include parameters via `ZTD_SQL_LOG_PARAMS`.
  - Logging is resilient to non-JSON primitives (e.g. `bigint`) and circular references, so enabling it won't crash a test run.

- [#334](https://github.com/mk3008/rawsql-ts/pull/334) [`d039a5e`](https://github.com/mk3008/rawsql-ts/commit/d039a5e756eeda0dac6bcac757a016476153ced2) Thanks [@mk3008](https://github.com/mk3008)! - `ztd init --with-app-interface` now appends the application interface guidance to `AGENTS.md` without touching the rest of the ZTD layout.

- [#347](https://github.com/mk3008/rawsql-ts/pull/347) [`734d5dd`](https://github.com/mk3008/rawsql-ts/commit/734d5dd8caeac60b9b22cd4379ca92c6fc965910) Thanks [@mk3008](https://github.com/mk3008)! - Safe cleanup for traditional clients
  - Traditional execution mode now always closes the Postgres client even when cleanup statements throw, so we avoid leaking connections after tests finish.
  - Any cleanup or client close error is recorded and rethrown after profiling finishes so users still observe the true failure.

- [#335](https://github.com/mk3008/rawsql-ts/pull/335) [`08acabf`](https://github.com/mk3008/rawsql-ts/commit/08acabfb2a319c09a00bd058cbe0af769837a422) Thanks [@mk3008](https://github.com/mk3008)! - `ztd init` now always creates `ztd/domain-specs/` and `ztd/enums/` directories so the new layout exposes those anchors whether they already exist or not.

- [#332](https://github.com/mk3008/rawsql-ts/pull/332) [`0ee677c`](https://github.com/mk3008/rawsql-ts/commit/0ee677cad032b36bff4834603efdfda037b2b743) Thanks [@mk3008](https://github.com/mk3008)! - ## Benchmark concurrency diagnostics
  - Traditional parallel in-process runs now report 95th percentile waiting, migration, and cleanup durations so the Markdown report surfaces where the parallel workflow spends its time.
  - ZTD in-process runs capture waiting p95 plus the peak number of PostgreSQL sessions for the largest measured suite, and the report now exposes them in a dedicated “ZTD Concurrency Diagnostics” section.
  - The documentation points to the new Vitest smoke test (`benchmarks/ztd-bench/tests/diagnostics/traditional-parallelism.test.ts`) so you can rerun the validation quickly before launching the full benchmark.

- [#322](https://github.com/mk3008/rawsql-ts/pull/322) [`d8d9508`](https://github.com/mk3008/rawsql-ts/commit/d8d95081d2feb67e9ce7fcc991e7991b44752782) Thanks [@mk3008](https://github.com/mk3008)! - Avoid unrelated changes in AI-assisted workflows

  Generated AGENTS.md now explicitly instructs AI assistants to avoid unrelated changes (format-only diffs, refactors, dependency upgrades, file renames, or regenerating artifacts) unless explicitly requested.

- [#354](https://github.com/mk3008/rawsql-ts/pull/354) [`daaa94b`](https://github.com/mk3008/rawsql-ts/commit/daaa94b4143d4c1555eb92cf39c4a1ebd2a829c2) Thanks [@mk3008](https://github.com/mk3008)! - Add template guidance that recommends reusing a shared SqlClient per worker process and avoiding cross-worker sharing to prevent unnecessary reconnects.

- [#356](https://github.com/mk3008/rawsql-ts/pull/356) [`261e95e`](https://github.com/mk3008/rawsql-ts/commit/261e95e6e13a426a3472bef25920f79c9d590774) Thanks [@mk3008](https://github.com/mk3008)! - Clarify AGENTS guidance for repository and test responsibilities so teams can follow consistent patterns when adding SQL or tests.

- [#332](https://github.com/mk3008/rawsql-ts/pull/332) [`0ee677c`](https://github.com/mk3008/rawsql-ts/commit/0ee677cad032b36bff4834603efdfda037b2b743) Thanks [@mk3008](https://github.com/mk3008)! - ## AST stringify microbenchmark
  - Added a standalone TypeScript script that parses the existing repository SQL to AST and measures the stringify step (`SqlFormatter.format`) in μs/ ns loops.
  - Documented how to run the script with `pnpm ts-node benchmarks/ztd-bench/stringify-only-benchmark.ts` and how to tune warmup/iteration counts.

- [#347](https://github.com/mk3008/rawsql-ts/pull/347) [`1b8c5b6`](https://github.com/mk3008/rawsql-ts/commit/1b8c5b6463bd84e86a2542368f8da32107982f6b) Thanks [@mk3008](https://github.com/mk3008)! - Document and test the new traditional execution mode for the CLI template testkit helper so Postgres schemas, fixtures, and cleanup strategies are exercised along with the existing ZTD workflow.

- [#332](https://github.com/mk3008/rawsql-ts/pull/332) [`0ee677c`](https://github.com/mk3008/rawsql-ts/commit/0ee677cad032b36bff4834603efdfda037b2b743) Thanks [@mk3008](https://github.com/mk3008)! - ## Traditional parallelism validation
  - Traditional parallel benchmarks now validate that they can open the requested number of concurrent PostgreSQL sessions and fail when a misconfiguration prevents concurrency.
  - Worker-scoped benchmark clients require explicit `workerId`s so each parallel worker keeps its own session and cannot be serialized by token reuse.
  - A new Vitest smoke test simulates a concurrent `pg_sleep` workload and guards future runs against regressions before the full benchmark executes.

- [#365](https://github.com/mk3008/rawsql-ts/pull/365) [`2255852`](https://github.com/mk3008/rawsql-ts/commit/2255852b37cacfda0cd326623d6ccb7f40120330) Thanks [@mk3008](https://github.com/mk3008)! - Reliable DDL watch updates on Windows
  - ztd-config --watch now detects DDL edits under configured directories on Windows.
  - Generated test row maps stay in sync without manual reruns.

- [#319](https://github.com/mk3008/rawsql-ts/pull/319) [`f644c8b`](https://github.com/mk3008/rawsql-ts/commit/f644c8bbd33b7537024b43fafeabbe3705fbc40a) Thanks [@mk3008](https://github.com/mk3008)! - Make `ztd init` produce a self-consistent scaffold by installing the devDependencies referenced by the generated templates.

  Postgres remains the default, so `@rawsql-ts/testkit-postgres` (and optionally `@rawsql-ts/adapter-node-pg`) are automatically added when they are not already declared.

- Updated dependencies [[`e3c97e4`](https://github.com/mk3008/rawsql-ts/commit/e3c97e44ce38e12a21a2a777ea504fd142738037), [`f73ed38`](https://github.com/mk3008/rawsql-ts/commit/f73ed380e888477789efbf27417d8d3451093218), [`18e8ef2`](https://github.com/mk3008/rawsql-ts/commit/18e8ef20ed1c2147e15f807eb91c0f61eb5481ae), [`963a1d1`](https://github.com/mk3008/rawsql-ts/commit/963a1d141612b981a344858fe9b1a2888a28f049), [`07735e5`](https://github.com/mk3008/rawsql-ts/commit/07735e5937fe7d78cffab9d47c213d78fcf24a0c), [`7dde2ab`](https://github.com/mk3008/rawsql-ts/commit/7dde2ab139c9029eb4b87e521bc91cb881695791), [`e8c7eed`](https://github.com/mk3008/rawsql-ts/commit/e8c7eedc454ee11205c5a117d7bf70a2dfdcc4f5), [`88a48d6`](https://github.com/mk3008/rawsql-ts/commit/88a48d63598f941aead4143c0ffeb05792e0af4e), [`e8f025a`](https://github.com/mk3008/rawsql-ts/commit/e8f025afc95004966d0a5f89f5d167bc77ffbeec), [`440133a`](https://github.com/mk3008/rawsql-ts/commit/440133ac48043af3da66cdfa73842a24c5142d84), [`7ac3280`](https://github.com/mk3008/rawsql-ts/commit/7ac328069c5458abd68a5ae78e8b791984a23b57)]:
  - rawsql-ts@0.14.0
  - @rawsql-ts/testkit-core@0.14.0

## 0.13.3

### Patch Changes

- [#304](https://github.com/mk3008/rawsql-ts/pull/304) [`e213234`](https://github.com/mk3008/rawsql-ts/commit/e213234f7bbbc709750ba40f798e2ffe7ee3d539) Thanks [@mk3008](https://github.com/mk3008)! - fix(ztd-cli): include templates in npm package and make init template resolution robust

- Updated dependencies []:
  - rawsql-ts@0.13.3
  - @rawsql-ts/testkit-core@0.13.3

## 0.13.2

### Patch Changes

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)! - Ensure published packages always include built `dist/` artifacts by building during the `prepack` lifecycle (and in the publish workflow). This fixes cases where `npx ztd init` fails with `MODULE_NOT_FOUND` due to missing compiled entrypoints.

- [#294](https://github.com/mk3008/rawsql-ts/pull/294) [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f) Thanks [@mk3008](https://github.com/mk3008)! - Ensure published packages always include built dist artifacts.

- Updated dependencies [[`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f), [`4e09e65`](https://github.com/mk3008/rawsql-ts/commit/4e09e65c6826c0116807f094f0793d4e96f1825f)]:
  - rawsql-ts@0.13.2
  - @rawsql-ts/testkit-core@0.13.2

## 0.13.1

### Patch Changes

- [`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be) Thanks [@mk3008](https://github.com/mk3008)! - Patch release to address dependency security advisories by updating Prisma tooling and ESLint, and pinning patched transitive versions via pnpm overrides.

- Updated dependencies [[`b01df7d`](https://github.com/mk3008/rawsql-ts/commit/b01df7dca83023e768c119162c8c5f39e39b74be)]:
  - rawsql-ts@0.13.1
  - @rawsql-ts/testkit-core@0.13.1

## 0.13.0

### Minor Changes

- Update ztd-cli and perform internal refactors and fixes across the workspace.

### Patch Changes

- Updated dependencies []:
  - rawsql-ts@0.13.0
  - @rawsql-ts/testkit-core@0.13.0
