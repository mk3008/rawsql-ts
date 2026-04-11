# @rawsql-ts/ztd-cli

## 0.25.0

### Minor Changes

- [#752](https://github.com/mk3008/rawsql-ts/pull/752) [`6bf1fcc`](https://github.com/mk3008/rawsql-ts/commit/6bf1fccfcf3cdce4b74cc42ef3d086c54defb54b) Thanks [@mk3008](https://github.com/mk3008)! - Add `ztd feature query scaffold` for creating child query boundaries under an existing boundary without rewriting the parent boundary.

  Promote `--scope-dir` as the primary `ztd query uses` narrowing flag while keeping `--specs-dir` as a deprecated compatibility alias.

  Support `MERGE ... RETURNING` as a writable CTE output shape in `rawsql-ts` so downstream SELECT and CTE analysis can resolve returned columns consistently across supported DML forms.

- [#756](https://github.com/mk3008/rawsql-ts/pull/756) [`a4f4b56`](https://github.com/mk3008/rawsql-ts/commit/a4f4b5663b65d2a913158c6916f969f3a05117a6) Thanks [@mk3008](https://github.com/mk3008)! - `ztd query uses` no longer accepts the deprecated `--specs-dir` alias. Use `--scope-dir` when you need to narrow the project-wide QuerySpec scan to one feature or subtree.

### Patch Changes

- [#740](https://github.com/mk3008/rawsql-ts/pull/740) [`36f6e6c`](https://github.com/mk3008/rawsql-ts/commit/36f6e6c249385c8d3e4aded063b100f2e2465d61) Thanks [@mk3008](https://github.com/mk3008)! - Stabilize scaffolded shared imports in deep recursive boundary layouts without rewriting every generated import style.

  Generated query-boundary files now use stable shared specifiers for `src/features/_shared/*` and `tests/support/*`, while nearby boundary-local imports stay relative. Starter scaffolds also add the matching package imports, TypeScript paths, and Vitest aliases so deeper boundary splits are less likely to break when code moves into lower child boundaries.

- Updated dependencies [[`6bf1fcc`](https://github.com/mk3008/rawsql-ts/commit/6bf1fccfcf3cdce4b74cc42ef3d086c54defb54b)]:
  - rawsql-ts@0.19.0
  - @rawsql-ts/adapter-node-pg@0.15.7
  - @rawsql-ts/sql-grep-core@0.1.8

## 0.24.3

### Patch Changes

- [#724](https://github.com/mk3008/rawsql-ts/pull/724) [`d6b7162`](https://github.com/mk3008/rawsql-ts/commit/d6b71629e6ae2f9000bf2e15153ccea967cebad8) Thanks [@mk3008](https://github.com/mk3008)! - Fix starter scaffolds so the Vitest setup derives `ZTD_TEST_DATABASE_URL` from `ZTD_DB_PORT`, which keeps the DB-backed smoke test aligned with the compose port even if an older localhost:5432 URL is still present. Add a regression test for the generated setup file so the port override stays authoritative.

- [#724](https://github.com/mk3008/rawsql-ts/pull/724) [`900faa8`](https://github.com/mk3008/rawsql-ts/commit/900faa810588adbd6550d7008bee9e181fa786e0) Thanks [@mk3008](https://github.com/mk3008)! - The starter scaffold now treats `.env` as the single source of truth for database connection settings. `compose.yaml` reads the DB host, port, name, user, and password from `.env`, and the generated Vitest setup derives `ZTD_TEST_DATABASE_URL` from those values. If a preexisting `ZTD_TEST_DATABASE_URL` conflicts with the starter DB settings, `ztd` now fails fast instead of silently choosing one source.

## 0.24.2

### Patch Changes

- [#722](https://github.com/mk3008/rawsql-ts/pull/722) [`fcc9d19`](https://github.com/mk3008/rawsql-ts/commit/fcc9d1990598483240a64bf0eb92f181c2682ff4) Thanks [@mk3008](https://github.com/mk3008)! - Update the starter smoke scaffold and documentation to use the feature-first layout with query-local ZTD assets under `src/features/<feature>/<query>/tests/`, including the new `smoke` starter structure.

## 0.24.1

### Patch Changes

- [#715](https://github.com/mk3008/rawsql-ts/pull/715) [`e3eba48`](https://github.com/mk3008/rawsql-ts/commit/e3eba48cca031f04573043ce73f078d3603d8ff0) Thanks [@mk3008](https://github.com/mk3008)! - Fix feature scaffold queryspec generation so CRUD baselines no longer import non-existent `sql-contract` cardinality helpers and instead use locally generated row-count handling.

## 0.24.0

### Minor Changes

- [#694](https://github.com/mk3008/rawsql-ts/pull/694) [`cc1102f`](https://github.com/mk3008/rawsql-ts/commit/cc1102fdbf19e43eff3a45fc1ffb0afb5218ccc4) Thanks [@mk3008](https://github.com/mk3008)! - Expand `ztd feature scaffold` so the CRUD boundary baseline now supports `--action update` and `--action delete` in addition to `insert`. The generated scaffold keeps the same `entryspec.ts` plus query-local `queryspec.ts` and SQL layout, uses `zod` DTO schemas at both boundaries, creates the empty `tests/` directory, and leaves the two test files for an AI follow-up step.

- [#692](https://github.com/mk3008/rawsql-ts/pull/692) [`073834c`](https://github.com/mk3008/rawsql-ts/commit/073834cc36edf4df41b4c3571957086f28012688) Thanks [@mk3008](https://github.com/mk3008)! - Simplify `ztd.config.json` by removing the legacy `ddl.defaultSchema` and `ddl.searchPath` mirror.

  `ztd-cli` now reads and writes schema resolution settings only from the top-level `defaultSchema` and `searchPath` fields. Projects that still keep those values under `ddl` must move them to the top level.

- [#695](https://github.com/mk3008/rawsql-ts/pull/695) [`329f194`](https://github.com/mk3008/rawsql-ts/commit/329f19483e71f9114534406bdea20b6f62b11c4e) Thanks [@mk3008](https://github.com/mk3008)! - Expand `ztd feature scaffold` so the baseline now supports `--action get-by-id` and `--action list` in addition to `insert`, `update`, and `delete`. The generated read scaffolds keep the same feature-local layout, use `queryZeroOrOneRow` for `get-by-id`, and keep default paging plus primary-key ordering inside `list/queryspec.ts` while returning `{ items: [...] }`.

  Generated feature/query specs now use shorter private helper names with responsibility-focused JSDoc, reject unsupported request fields by default, and derive bigint-like ID contracts from the DDL instead of assuming 32-bit numeric IDs.

- [#693](https://github.com/mk3008/rawsql-ts/pull/693) [`ead64e3`](https://github.com/mk3008/rawsql-ts/commit/ead64e37a05a502f9814e9b6a90ff1190c501221) Thanks [@mk3008](https://github.com/mk3008)! - Add a new `ztd feature scaffold` command for insert feature scaffolds. The command creates the fixed feature layout, writes the placeholder feature entrypoint, SQL file, and README, creates the `tests/` directory, and leaves the two test files for an AI follow-up step.

- [#696](https://github.com/mk3008/rawsql-ts/pull/696) [`a4263c6`](https://github.com/mk3008/rawsql-ts/commit/a4263c66d5eaa97ddfd406b008af7b78caf057f2) Thanks [@mk3008](https://github.com/mk3008)! - Redefine the default project layout around `src/`, `db/ddl/`, and `.ztd/`.

  `ztd init` and `ztd init --starter` now treat `db/ddl` as the human-owned schema source of truth and `.ztd` as the tool-managed workspace for generated and support files. The legacy root `ztd/` and `tests/` layout is no longer supported, and the CLI now reports explicit migration guidance when that older layout is detected.

  This release also removes `SKILL` scaffold output from the Codex bootstrap path, updates the starter docs and dogfooding prompts to match the current feature scaffold shape, and makes monorepo dogfooding installs keep using the local `@rawsql-ts/ztd-cli` package so the generated project matches the current command surface during verification.

### Patch Changes

- [#696](https://github.com/mk3008/rawsql-ts/pull/696) [`686edf2`](https://github.com/mk3008/rawsql-ts/commit/686edf2d23960d8108b4c01777364980183664fe) Thanks [@mk3008](https://github.com/mk3008)! - Fix two dogfooded workflow gaps in the current starter/tutorial path.

  `ztd query uses` now discovers scaffolded feature-local `queryspec.ts` files that load SQL through `loadSqlResource(...)`, so DDL repair and usage search work against the generated VSA layout instead of reporting that no QuerySpec entries were found.

  `ztd model-gen --probe-mode ztd` now handles starter-style `INSERT ... RETURNING` scaffolds more reliably by deriving RETURNING column types from the loaded DDL metadata when direct probing cannot resolve them, and it also reads starter `.env` settings to find the ZTD-owned test database without requiring a manually exported runtime connection variable.

- [#691](https://github.com/mk3008/rawsql-ts/pull/691) [`774601c`](https://github.com/mk3008/rawsql-ts/commit/774601c7b482e922665ba7ec075f255530720815) Thanks [@mk3008](https://github.com/mk3008)! - Strengthen the starter guidance and repository troubleshooting notes so SQL-backed QuerySpecs are treated as ZTD-backed tests, and SQL shadowing failures are diagnosed before considering schema changes.

- Updated dependencies [[`686edf2`](https://github.com/mk3008/rawsql-ts/commit/686edf2d23960d8108b4c01777364980183664fe)]:
  - @rawsql-ts/sql-grep-core@0.1.7

## 0.23.0

### Minor Changes

- Clarify the managed workspace layout and bootstrap ownership for new projects. DDL now defaults to `db/ddl`, repo-managed generated/support files live under `.ztd/`, the removed root `ztd/` and `tests/` layouts now fail with explicit migration guidance, and `ztd agents init` no longer scaffolds or ships `SKILL` assets.

- [#679](https://github.com/mk3008/rawsql-ts/pull/679) [`be9b689`](https://github.com/mk3008/rawsql-ts/commit/be9b6893ff42f783f9cb52f1b8cd9cdc6c120e23) Thanks [@mk3008](https://github.com/mk3008)! - Add SSSQL scaffold and refresh commands, and change `DynamicQueryBuilder` so legacy runtime filter predicates fail fast instead of being injected at runtime. Runtime optional-condition pruning, sort, and paging remain supported.

### Patch Changes

- [#682](https://github.com/mk3008/rawsql-ts/pull/682) [`07eb7fd`](https://github.com/mk3008/rawsql-ts/commit/07eb7fdda0b932f3f6bc13d58767e57927d6707e) Thanks [@mk3008](https://github.com/mk3008)! - The starter README now stays focused on entry points, while the repository telemetry setup and observed SQL investigation flows are documented in separate guides.

  You can now follow step-by-step instructions for editing the generated telemetry scaffold, emitting safe structured logs, reviewing queryId-based incidents, and running `ztd query match-observed` when `queryId` is missing.

- [#687](https://github.com/mk3008/rawsql-ts/pull/687) [`937bb1c`](https://github.com/mk3008/rawsql-ts/commit/937bb1c42484ae4dda72cfac787734d35f485502) Thanks [@mk3008](https://github.com/mk3008)! - `ztd agents init` now installs an opt-in customer-facing Codex bootstrap with visible `AGENTS.md`, `.codex`, and `.agents` guidance. The command surface, templates, status reporting, and docs were updated so reviewers can verify the managed set and the current local `spawn EPERM` blocker separately.

- [#669](https://github.com/mk3008/rawsql-ts/pull/669) [`0d61ffe`](https://github.com/mk3008/rawsql-ts/commit/0d61ffe7a464133d8d8b6720bcdd43aea432fceb) Thanks [@mk3008](https://github.com/mk3008)! - The starter quickstart now uses a `.env`-based setup flow, includes `.env.example` and `.gitignore`, and loads the starter runtime connection consistently in Vitest. The generated README and tutorial were updated to keep the database port and test runtime aligned.

- [#673](https://github.com/mk3008/rawsql-ts/pull/673) [`7f4035a`](https://github.com/mk3008/rawsql-ts/commit/7f4035a3caeba7f0b15247957bb0d360beef1296) Thanks [@mk3008](https://github.com/mk3008)! - Improve the starter smoke path so it points to `@rawsql-ts/testkit-postgres` and `createPostgresTestkitClient`, and clarify the generated testkit guidance in the starter docs.

- [#672](https://github.com/mk3008/rawsql-ts/pull/672) [`68b385e`](https://github.com/mk3008/rawsql-ts/commit/68b385e0407b8a610078ea4c07ee0c602e6910ed) Thanks [@mk3008](https://github.com/mk3008)! - `ztd-config` now reuses shared DDL analysis for linting and table metadata generation, and skips no-op config writes so telemetry matches actual persistence.

- Updated dependencies [[`07eb7fd`](https://github.com/mk3008/rawsql-ts/commit/07eb7fdda0b932f3f6bc13d58767e57927d6707e), [`be9b689`](https://github.com/mk3008/rawsql-ts/commit/be9b6893ff42f783f9cb52f1b8cd9cdc6c120e23)]:
  - @rawsql-ts/sql-grep-core@0.1.6
  - rawsql-ts@0.18.0
  - @rawsql-ts/adapter-node-pg@0.15.6

## 0.22.5

### Patch Changes

- [#660](https://github.com/mk3008/rawsql-ts/pull/660) [`2bc9b36`](https://github.com/mk3008/rawsql-ts/commit/2bc9b369918e395ef7fd4eb7fad30b9f42869a00) Thanks [@mk3008](https://github.com/mk3008)! - Improve the starter quickstart and smoke scaffold so the Docker daemon prerequisite is easier to spot, and align the starter `smoke` QuerySpec with the feature-local SQL file path generated by `ztd init`.

## 0.22.4

### Patch Changes

- [#653](https://github.com/mk3008/rawsql-ts/pull/653) [`4540a22`](https://github.com/mk3008/rawsql-ts/commit/4540a22a57c600cbd4f4dbe2fe160cd8da1fb12e) Thanks [@mk3008](https://github.com/mk3008)! - Improve `query uses` for feature-local VSA projects by discovering QuerySpec files from the project tree, preferring spec-relative SQL resolution, and clarifying the VSA-first impact-analysis contract in docs and CLI help.

- [#652](https://github.com/mk3008/rawsql-ts/pull/652) [`303a549`](https://github.com/mk3008/rawsql-ts/commit/303a549ce713d4bd53cfa5d30ec1c2515cf9ea06) Thanks [@mk3008](https://github.com/mk3008)! - Republish `@rawsql-ts/ztd-cli` so the published CLI surface for `ztd query lint --rules join-direction` stays aligned with the current Further Reading docs.

  Clarify the public help and guide text so users can confirm that their installed CLI exposes `--rules` before trying the join-direction examples.

- Updated dependencies [[`4540a22`](https://github.com/mk3008/rawsql-ts/commit/4540a22a57c600cbd4f4dbe2fe160cd8da1fb12e)]:
  - @rawsql-ts/sql-grep-core@0.1.5

## 0.22.3

### Patch Changes

- [#647](https://github.com/mk3008/rawsql-ts/pull/647) [`bbdae2c`](https://github.com/mk3008/rawsql-ts/commit/bbdae2cadcbd8668fb5f823168c4f1b5eff8a02f) Thanks [@mk3008](https://github.com/mk3008)! - Improve `ztd ddl diff` reviewability by emitting review-first text/json summaries alongside a SQL artifact, and update the migration docs to explain how to inspect and apply the generated files.

- [#646](https://github.com/mk3008/rawsql-ts/pull/646) [`fe400bc`](https://github.com/mk3008/rawsql-ts/commit/fe400bcdbdb1e71de85b6f65a15de46738480730) Thanks [@mk3008](https://github.com/mk3008)! - Add a published-package verification gate that checks `ztd query lint --help` still exposes `--rules` and that `ztd query lint --rules join-direction <sql-file>` runs on the packed CLI path. This keeps the release contract aligned with the Further Reading docs for the join-direction lint command surface.

- [#649](https://github.com/mk3008/rawsql-ts/pull/649) [`6991c7e`](https://github.com/mk3008/rawsql-ts/commit/6991c7e018f10bb2fc5d3d64ba3641aa7ef0219e) Thanks [@mk3008](https://github.com/mk3008)! - Extract the DDL diff risk analyzer into reusable plan-based and SQL-based evaluators so generated and hand-edited migration SQL can be assessed through the same structured risk contract.

## 0.22.2

### Patch Changes

- Republish `@rawsql-ts/sql-contract` with its runtime `dist/` artifacts so standalone consumers can run `ztd model-gen` in the starter tutorial without a missing module error.

  Refresh the starter README generated by `@rawsql-ts/ztd-cli` so standalone users can recover from a busy `5432` port and keep using `pnpm add -D` when the project was initialized with pnpm.

## 0.22.1

### Patch Changes

- [#628](https://github.com/mk3008/rawsql-ts/pull/628) [`b579253`](https://github.com/mk3008/rawsql-ts/commit/b5792534c0f01934274c7db980fbe651c58fda4a) Thanks [@mk3008](https://github.com/mk3008)! - Fix the init scaffold so `@rawsql-ts/testkit-core` is installed automatically and `npx ztd ztd-config` works in a fresh standalone project.

- Updated dependencies [[`5d15113`](https://github.com/mk3008/rawsql-ts/commit/5d151130b492b0bfbb787a1410ceb1eeee0683e6)]:
  - @rawsql-ts/sql-grep-core@0.1.4
  - @rawsql-ts/test-evidence-renderer-md@0.3.2

## 0.22.0

### Minor Changes

- [#626](https://github.com/mk3008/rawsql-ts/pull/626) [`25fdcd3`](https://github.com/mk3008/rawsql-ts/commit/25fdcd321a239cfeb77d4a9b4fcaaff2f479d88a) Thanks [@mk3008](https://github.com/mk3008)! - Refresh the ztd-cli starter workflow and README so the feature-first starter scaffold, AI prompt, tutorial, and dogfooding guidance line up with the new first-run experience.

### Patch Changes

- [#621](https://github.com/mk3008/rawsql-ts/pull/621) [`ecd69d2`](https://github.com/mk3008/rawsql-ts/commit/ecd69d267ae959a65a92fc61b646d098e90ced74) Thanks [@mk3008](https://github.com/mk3008)! - Keep the generated QuerySpec sample aligned with the published consumer smoke path and add a contract guard for uncovered SQL assets so the scaffolded repository example validates raw rows correctly.

- [#625](https://github.com/mk3008/rawsql-ts/pull/625) [`9a4aab3`](https://github.com/mk3008/rawsql-ts/commit/9a4aab3e59310d60c65794d373f071f7c3016ed7) Thanks [@mk3008](https://github.com/mk3008)! - Add `ztd findings validate` so machine-readable finding registries can be checked deterministically in CI or locally.

- [#624](https://github.com/mk3008/rawsql-ts/pull/624) [`c6495af`](https://github.com/mk3008/rawsql-ts/commit/c6495afa7c2f18c25ebf33f31f434482ef44f453) Thanks [@mk3008](https://github.com/mk3008)! - Add a small PostgreSQL 18 Docker helper to the Getting Started with AI guidance so users can bootstrap a local ZTD test database more easily.

- [#623](https://github.com/mk3008/rawsql-ts/pull/623) [`eedf9db`](https://github.com/mk3008/rawsql-ts/commit/eedf9db9bac9d4200d73bd67eb6dc9885b13873b) Thanks [@mk3008](https://github.com/mk3008)! - Add a machine-readable finding registry example, validation helper, and docs link so dogfooding findings can carry evidence and status consistently.

## 0.21.0

### Minor Changes

- [#616](https://github.com/mk3008/rawsql-ts/pull/616) [`33b300c`](https://github.com/mk3008/rawsql-ts/commit/33b300c147c909296f5a29f547a12210ed612170) Thanks [@mk3008](https://github.com/mk3008)! - Remove the scaffold's `tables/` and `views/` folders and update the docs, AGENTS guidance, and tests so `1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO` is the only query-unit storage rule.

### Patch Changes

- [#610](https://github.com/mk3008/rawsql-ts/pull/610) [`41b6729`](https://github.com/mk3008/rawsql-ts/commit/41b672995f4ffd3d825aaef03697d818e20e2fd8) Thanks [@mk3008](https://github.com/mk3008)! - Clarify repo policy interpretation so `MUST` and `REQUIRED` mean completion criteria, and add a regression test for the canonical policy mirror.

- [#613](https://github.com/mk3008/rawsql-ts/pull/613) [`99535b1`](https://github.com/mk3008/rawsql-ts/commit/99535b16c00423756c32e37f9d63982cfaede5ed) Thanks [@mk3008](https://github.com/mk3008)! - Clarify repository intent and procedure so source assets and downstream artifacts are read as causality, not just rules.

## 0.20.3

### Patch Changes

- [#589](https://github.com/mk3008/rawsql-ts/pull/589) [`70b928d`](https://github.com/mk3008/rawsql-ts/commit/70b928d81096165e66ff6578baa78354f39db4b2) Thanks [@mk3008](https://github.com/mk3008)! - Fix npm consumer compatibility for `ztd-cli` by removing the hard `pnpm-workspace.yaml` runtime assumption, requiring `--force` for scaffold overwrites, and emitting Node16/NodeNext-friendly `.js` template imports.

  Keep `@rawsql-ts/sql-contract-zod` publishable with a prepack build step while documenting that new projects should prefer `@rawsql-ts/sql-contract` with `zod`.

## 0.20.2

### Patch Changes

- Updated dependencies [[`214bb0a`](https://github.com/mk3008/rawsql-ts/commit/214bb0a8d6ceffb193e78d7531d78d6d2182b34a)]:
  - @rawsql-ts/sql-grep-core@0.1.3

## 0.20.1

### Patch Changes

- [#571](https://github.com/mk3008/rawsql-ts/pull/571) [`6fd0afa`](https://github.com/mk3008/rawsql-ts/commit/6fd0afa9b3faef0e41ba6a56e3d40fc507a9172a) Thanks [@mk3008](https://github.com/mk3008)! - Fix published package manifests so npm consumers do not receive `workspace:` dependency ranges when installing `@rawsql-ts/ztd-cli` and its internal runtime dependencies.

- Updated dependencies [[`6fd0afa`](https://github.com/mk3008/rawsql-ts/commit/6fd0afa9b3faef0e41ba6a56e3d40fc507a9172a)]:
  - @rawsql-ts/sql-grep-core@0.1.2
  - @rawsql-ts/test-evidence-renderer-md@0.3.1

## 0.20.0

### Minor Changes

- [#566](https://github.com/mk3008/rawsql-ts/pull/566) [`90c9eb2`](https://github.com/mk3008/rawsql-ts/commit/90c9eb24de83580211fe0bb45d6bf4c53c2f9efb) Thanks [@mk3008](https://github.com/mk3008)! - `ztd init` now keeps the default scaffold focused on consumer-facing project files.

  AI guidance artifacts such as `CONTEXT.md`, `PROMPT_DOGFOOD.md`, and `.ztd/agents/*` are no longer generated by default. If you want those files in the scaffold, pass `--with-ai-guidance`.

  Local-source developer mode also keeps generated consumer code on normal `@rawsql-ts/sql-contract` package imports instead of emitting local shim files into the project tree.

## 0.19.0

### Minor Changes

- [#552](https://github.com/mk3008/rawsql-ts/pull/552) [`953c569`](https://github.com/mk3008/rawsql-ts/commit/953c5699ee8cd6125335fc4443e24891d1a7fae1) Thanks [@mk3008](https://github.com/mk3008)! - Add ztd evidence test-doc to export human-readable Markdown test documentation from deterministic ZTD test assets.

### Patch Changes

- [#551](https://github.com/mk3008/rawsql-ts/pull/551) [`bf369a8`](https://github.com/mk3008/rawsql-ts/commit/bf369a8cf5c873d0820221285209b70ea87f164a) Thanks [@mk3008](https://github.com/mk3008)! - Add QuerySpec perf scale metadata and surface spec-driven perf guidance in ztd-cli benchmark reports.

- Updated dependencies [[`b56a3fa`](https://github.com/mk3008/rawsql-ts/commit/b56a3fa82763c4120f73b2cec9f295c55c951609), [`953c569`](https://github.com/mk3008/rawsql-ts/commit/953c5699ee8cd6125335fc4443e24891d1a7fae1)]:
  - rawsql-ts@0.17.0
  - @rawsql-ts/test-evidence-renderer-md@0.3.0
  - @rawsql-ts/adapter-node-pg@0.15.4
  - @rawsql-ts/sql-grep-core@0.1.1

## 0.18.0

### Minor Changes

- [#451](https://github.com/mk3008/rawsql-ts/pull/451) [`40c4d82`](https://github.com/mk3008/rawsql-ts/commit/40c4d8259b8808a25dc77b61fa3fd324856a80b8) Thanks [@mk3008](https://github.com/mk3008)! - Keep deterministic test-evidence semantic transforms in @rawsql-ts/test-evidence-core and add a pure buildSpecificationModel intermediate model API with schemaVersion validation and typed deterministic errors.

  Add @rawsql-ts/test-evidence-renderer-md for markdown projection only, then update @rawsql-ts/ztd-cli to consume core semantics and renderer projections via explicit boundaries.

- [#505](https://github.com/mk3008/rawsql-ts/pull/505) [`8127f60`](https://github.com/mk3008/rawsql-ts/commit/8127f60b55cb0f1d2691a01fffdaf6d0feeb5ef3) Thanks [@mk3008](https://github.com/mk3008)! - Add agent-first CLI improvements to `ztd-cli`, including a global `--output json` mode, a new `describe` command, dry-run support for write-capable commands, JSON payload input paths, and stricter input hardening for file paths and identifiers.

- [#505](https://github.com/mk3008/rawsql-ts/pull/505) [`4fb22e3`](https://github.com/mk3008/rawsql-ts/commit/4fb22e3262f7e00bfddc65ba82b2ff1a2e3e0e86) Thanks [@mk3008](https://github.com/mk3008)! - Change `ztd init` to write managed internal agent guidance under `.ztd/agents/` by default, add `ztd agents install` and `ztd agents status`, and stop auto-creating visible `AGENTS.md` files unless explicitly installed.

- [#446](https://github.com/mk3008/rawsql-ts/pull/446) [`06cd070`](https://github.com/mk3008/rawsql-ts/commit/06cd07084a50884d54613561ba760b3a10e37284) Thanks [@mk3008](https://github.com/mk3008)! - Add a new `ztd evidence --mode specification` command that exports deterministic JSON and Markdown artifacts derived from SQL catalog specs and test case definitions.

- [#487](https://github.com/mk3008/rawsql-ts/pull/487) [`9e5db08`](https://github.com/mk3008/rawsql-ts/commit/9e5db08fd0a7fe7a43f980d6684b879550712f0f) Thanks [@mk3008](https://github.com/mk3008)! - Add `impact` and `detail` views to `ztd query uses`, improve clause-aware detail locations, and show a friendly hint when no catalog specs are discoverable.

- [#488](https://github.com/mk3008/rawsql-ts/pull/488) [`8ecca4b`](https://github.com/mk3008/rawsql-ts/commit/8ecca4b349331b7c4a8f2a5a40f760531cf413d9) Thanks [@mk3008](https://github.com/mk3008)! - Add a local-source dogfooding mode to `ztd init` via `--local-source-root`.

  The new mode links `@rawsql-ts/sql-contract` from a local monorepo path, emits `src/local/sql-contract.ts`, and switches the scaffold runtime coercion import to the local shim so a fresh project under `tmp/` can reach `pnpm install`, `pnpm typecheck`, and the template smoke tests without published rawsql-ts packages.

- [#486](https://github.com/mk3008/rawsql-ts/pull/486) [`4c905f7`](https://github.com/mk3008/rawsql-ts/commit/4c905f7f345682c3f4bd6a514a244232e02d07e4) Thanks [@mk3008](https://github.com/mk3008)! - Add `ztd model-gen` to generate names-first QuerySpec scaffolds from live PostgreSQL metadata.

- [#487](https://github.com/mk3008/rawsql-ts/pull/487) [`9cd9068`](https://github.com/mk3008/rawsql-ts/commit/9cd90682ce65d9e0f04730f18795013bfa7c5d2f) Thanks [@mk3008](https://github.com/mk3008)! - Add strict-first `ztd query uses` commands for table and column impact investigation with deterministic output, explicit uncertainty labels, shared SQL catalog discovery, and stable statement fingerprints.

### Patch Changes

- [#488](https://github.com/mk3008/rawsql-ts/pull/488) [`9d9b8aa`](https://github.com/mk3008/rawsql-ts/commit/9d9b8aae1e36b1ac4a08dcad59a9eba05315ac6b) Thanks [@mk3008](https://github.com/mk3008)! - Default `ztd query uses` to the impact view in docs/help and add `--exclude-generated` to skip `src/catalog/specs/generated` during impact scans when those specs are review-only noise.

- [#506](https://github.com/mk3008/rawsql-ts/pull/506) [`1cb9aef`](https://github.com/mk3008/rawsql-ts/commit/1cb9aef7402d00f19a8bebe416f845b9efd36a88) Thanks [@mk3008](https://github.com/mk3008)! - Clarify published vs local-source dogfooding, ensure fresh `ztd init` installs scaffold dependencies, inline scaffold timestamp coercions so generated smoke tests run against the published sql-contract package, make `serial8` DDL mapping generate stable numeric types, align release verification with `pnpm pack/publish` so workspace dependencies are rewritten consistently, and add a repository-root published-package smoke check that packs internal tarballs and reuses them via local overrides before release. Publish `@rawsql-ts/shared-binder`, `@rawsql-ts/test-evidence-core`, and `@rawsql-ts/test-evidence-renderer-md` so released packages can resolve their runtime evidence and binder dependencies.

- [#451](https://github.com/mk3008/rawsql-ts/pull/451) [`77ba0be`](https://github.com/mk3008/rawsql-ts/commit/77ba0be9506a547f2ac397c82ac69957b76c8fa9) Thanks [@mk3008](https://github.com/mk3008)! - Fix markdown definition/file links to be resolved relative to each markdown output location in local path mode.

  When GitHub Actions metadata is not present, renderer links now compute relative paths from the markdown directory to the source definition path, preventing broken links in generated artifacts.

- [#451](https://github.com/mk3008/rawsql-ts/pull/451) [`ea03f55`](https://github.com/mk3008/rawsql-ts/commit/ea03f55a6dad7e61f737da453256bde64454442e) Thanks [@mk3008](https://github.com/mk3008)! - Refine unit test specification markdown for review readability with flattened headings, strict two-axis tags, consistent focus phrasing, and catalog/case-level refs. Enforce throws error block rendering and deterministic metadata ordering.

- [#460](https://github.com/mk3008/rawsql-ts/pull/460) [`8b7535c`](https://github.com/mk3008/rawsql-ts/commit/8b7535c61a9dd11c239116387df40986371a48c9) Thanks [@mk3008](https://github.com/mk3008)! - Fix the ztd-cli build pipeline so it builds the test-evidence workspace dependencies before compiling the CLI package.

- [#474](https://github.com/mk3008/rawsql-ts/pull/474) [`606c99a`](https://github.com/mk3008/rawsql-ts/commit/606c99a49fb384197afb3d8a00511c1737a0dea6) Thanks [@mk3008](https://github.com/mk3008)! - Onboarding & discoverability improvements (Epic #463):
  - Add copy-pasteable "Happy Path Quickstart" to README
  - Document DDL/schema change workflow with common patterns
  - Add `--workflow` and `--validator` flags for non-interactive `ztd init --yes`
  - Improve `ztd --help` with "Getting started" and "Common workflow" guidance
  - Print next-step hints after `ztd-config` (suppress with `--quiet`)
  - Include `fromPg()` SqlClient conversion helper in scaffolded templates
  - Add docs for rowMapping/coerce vs validator pipeline order
  - Add Postgres pitfalls guide, spec-change scenarios digest, and feature index

- [#488](https://github.com/mk3008/rawsql-ts/pull/488) [`3d27115`](https://github.com/mk3008/rawsql-ts/commit/3d27115d8497c3c8046c5d1e2b8acc363c1d6a7d) Thanks [@mk3008](https://github.com/mk3008)! - Teach `ztd query uses` to resolve existing `spec.sqlFile` values against a project SQL root such as `src/sql` before falling back to legacy spec-relative lookup, and improve unresolved-file guidance.

- [#488](https://github.com/mk3008/rawsql-ts/pull/488) [`fd9d1b2`](https://github.com/mk3008/rawsql-ts/commit/fd9d1b25c152ce039ff4ab20f8163fb889d3c5a2) Thanks [@mk3008](https://github.com/mk3008)! - Improve ZTD-first dogfooding and scaffold feedback.
  - make `ztd init` detect parent pnpm workspaces and use `--ignore-workspace` for its own install step
  - add local-source dogfooding guidance for nested workspaces and generated import overrides
  - let `ztd model-gen` generate local-friendly `sql-contract` imports via `--import-style` and `--import-from`
  - strengthen the default scaffold smoke tests and placeholder diagnostics so wiring mistakes fail with clearer messages

- [#487](https://github.com/mk3008/rawsql-ts/pull/487) [`a9d2129`](https://github.com/mk3008/rawsql-ts/commit/a9d21291c7734683f9a5cb07a4d8abac6a880345) Thanks [@mk3008](https://github.com/mk3008)! - Improve `ztd query uses` stability by keeping usage-kind summaries deterministic, bounding statement-location cache growth, and isolating spec-load failures so one bad spec file does not abort the full report.

- [#488](https://github.com/mk3008/rawsql-ts/pull/488) [`89f2fd5`](https://github.com/mk3008/rawsql-ts/commit/89f2fd5fd27576a514309024a2bf7b4d25b6ec20) Thanks [@mk3008](https://github.com/mk3008)! - Align `ztd query uses table --view detail` snippets and locations to the matched table reference token so impact scans point at the actual table node instead of a nearby clause token.

- [#442](https://github.com/mk3008/rawsql-ts/pull/442) [`7f62025`](https://github.com/mk3008/rawsql-ts/commit/7f62025f9f97449375a3d549d1cc13cb210cc319) Thanks [@mk3008](https://github.com/mk3008)! - Add deterministic `ztd check contract` validation with stable exit semantics, root-level AST wildcard safety checks, and CLI/unit coverage for contract diagnostics.

- Updated dependencies [[`40c4d82`](https://github.com/mk3008/rawsql-ts/commit/40c4d8259b8808a25dc77b61fa3fd324856a80b8), [`1cb9aef`](https://github.com/mk3008/rawsql-ts/commit/1cb9aef7402d00f19a8bebe416f845b9efd36a88), [`77ba0be`](https://github.com/mk3008/rawsql-ts/commit/77ba0be9506a547f2ac397c82ac69957b76c8fa9), [`ea03f55`](https://github.com/mk3008/rawsql-ts/commit/ea03f55a6dad7e61f737da453256bde64454442e), [`8acdf88`](https://github.com/mk3008/rawsql-ts/commit/8acdf88ebc743d1ce1ed3c85c9b085c6b8456afc), [`e960404`](https://github.com/mk3008/rawsql-ts/commit/e96040413ce357c0c86fe87f886b9d8cce6cb44e)]:
  - @rawsql-ts/test-evidence-core@0.2.0
  - @rawsql-ts/test-evidence-renderer-md@0.2.0
  - @rawsql-ts/adapter-node-pg@0.15.3
  - rawsql-ts@0.16.1

## 0.17.0

### Minor Changes

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`36fd789`](https://github.com/mk3008/rawsql-ts/commit/36fd7898926abf318873350ec3aeb5a28a60e021) Thanks [@mk3008](https://github.com/mk3008)! - Adopt SQL-first scaffolding with named-parameter SQL layout in the ZTD template, and compile named parameters to indexed placeholders in the pg adapter.

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`83e870a`](https://github.com/mk3008/rawsql-ts/commit/83e870aa945b75cdf894c8a620309e6d54dba178) Thanks [@mk3008](https://github.com/mk3008)! - Redesign `ztd init` to produce a deterministic minimal scaffold with per-folder AGENTS.md guidance and option-specific DDL seeding only (pg_dump, empty, or demo DDL).

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`bf588fd`](https://github.com/mk3008/rawsql-ts/commit/bf588fd73e4fd728b193dd795e449729e6b554b5) Thanks [@mk3008](https://github.com/mk3008)! - Add the new default ZTD scaffold layout with view SQL under "src/sql/views", job SQL under "src/sql/jobs", and repositories split between "src/repositories/views" and "src/repositories/tables". The init command now supports "--yes" to overwrite existing scaffold files without prompts for non-interactive runs.

### Patch Changes

- [#433](https://github.com/mk3008/rawsql-ts/pull/433) [`06ec7ea`](https://github.com/mk3008/rawsql-ts/commit/06ec7ea2c54b9561ff74cbbd6c13d8cc7ef6f9dc) Thanks [@mk3008](https://github.com/mk3008)! - Add a new public `timestampFromDriver(value, fieldName?)` helper in `@rawsql-ts/sql-contract` for fail-fast `Date | string` normalization of driver-returned timestamps.

  Update `@rawsql-ts/ztd-cli` templates to normalize runtime timestamp fields through the shared sql-contract helper (via runtime coercion wiring), add strict guardrails against local timestamp re-implementation, and expand scaffold smoke validation tests for valid and invalid timestamp strings.

- [#435](https://github.com/mk3008/rawsql-ts/pull/435) [`345a4a1`](https://github.com/mk3008/rawsql-ts/commit/345a4a1ad0354e975f47200f0f222696fa67a326) Thanks [@mk3008](https://github.com/mk3008)! - Fix optional adapter resolution during SQL lint execution so workspace and test environments no longer require prebuilt dist artifacts.

- Updated dependencies [[`36fd789`](https://github.com/mk3008/rawsql-ts/commit/36fd7898926abf318873350ec3aeb5a28a60e021)]:
  - @rawsql-ts/adapter-node-pg@0.15.2

## 0.16.0

### Minor Changes

- [#411](https://github.com/mk3008/rawsql-ts/pull/411) [`84ec3a0`](https://github.com/mk3008/rawsql-ts/commit/84ec3a0c5f3e16463c1eee532fc9570bf1bcff93) Thanks [@mk3008](https://github.com/mk3008)! - Document that the CLI templates treat db/ddl as the only authoritative source, keep optional references purely informational, and ship the mapper/writer sample with its supporting tests.

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
  - Generated `.ztd/support/testkit-client.ts` can emit structured logs showing the SQL before and after pg-testkit rewrites it.
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
