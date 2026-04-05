# Zero Table Dependency Project

This scaffold starts from `ztd init`.

This generated project is either:

- standalone customer-facing output that resolves published packages, or
- local-source dogfood output that resolves `rawsql-ts` packages through `file:` dependencies back to a monorepo checkout

Check `package.json` to see which mode you are in. If you see `file:` dependencies that point back to a monorepo checkout, this is a local-source dogfood workspace and the monorepo checkout is the source of truth.

The project is feature-first by default:

- keep SQL, specs, and tests close to each feature
- use `@rawsql-ts/sql-contract` for QuerySpec contracts
- keep user-facing tests under `src/features/<feature>/tests/`
- keep tool-managed ZTD workspace files under `.ztd/tests/` and `.ztd/generated/`
- `ztd.config.json` controls the tool-managed test workspace while the feature-local tests stay next to the feature they cover

When you add SQL-backed tests, copy `.env.example` to `.env` and adjust `ZTD_DB_PORT` if needed before running the DB-backed suites.

```bash
npx vitest run src/features/**/*.test.ts
```

The generated runtime manifest is the preferred input for `@rawsql-ts/testkit-postgres`; raw DDL directories remain a fallback for legacy layouts. The generated contract itself is schema metadata only (`tableDefinitions`), so test rows stay explicit.
The starter keeps `ztdRootDir`, `ddlDir`, `defaultSchema`, and `searchPath` in `ztd.config.json`. The helper reads the project defaults from one place instead of repeating them in every DB-backed test.

`src/features/<feature>/tests/` is where feature-local entryspec and queryspec tests live. `.ztd/tests/` is the tool-managed workspace for generated support files and ZTD runtime artifacts.

## Getting Started with AI

Use this short prompt:
Choose `ztd init` or `ztd init --starter` based on whether you want the removable starter sample.

```text
I want to build a feature-first application with @rawsql-ts/ztd-cli.
Keep handwritten SQL, QuerySpec, repository code, and tests inside `src/features/<feature-name>`.
Treat the QuerySpec and its ZTD-backed test as one completion unit; do not stop at a property-only check.
Keep entryspec tests mock-based in `src/features/<feature-name>/tests/<feature-name>.entryspec.test.ts`.
Make sure the queryspec result executes through the DB-backed ZTD path and checks mapping and validation, not just property values.
Do not put returned columns into the input fixture; assert them only after the DB-backed result returns.
If the returned result is `null`, stop and fix the scaffold or DDL instead of weakening the success-path schema or seeding fake rows.
Before writing the success-path assertion, inspect the current SQL and QuerySpec. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
After the SQL and DTO edits settle, run `ztd feature tests scaffold --feature <feature-name>` to refresh `tests/generated/TEST_PLAN.md` and `analysis.json`, create the thin `tests/<query-name>.queryspec.ztd.test.ts` Vitest entrypoint if it is missing, and keep `tests/cases/` as human/AI-owned persistent cases around the fixed app-level ZTD runner. `generated/*` is CLI-owned and refreshable, while the thin entrypoint is kept. If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs. `beforeDb` and `afterDb` are pure fixture skeletons with schema-qualified table keys. `afterDb` is subset-based per row, rows are treated as an unordered multiset, and row order itself is ignored. The verifier truncates tables named in `beforeDb` with `restart identity cascade` before seeding. When the cases are ready, run `npx vitest run src/features/<feature-name>/<query-name>/tests/<query-name>.queryspec.ztd.test.ts` to execute the ZTD query test.

## Troubleshooting

- If a DB-backed ZTD case returns `user_id: null`, inspect the fixture manifest and rewrite path before weakening the case.
- Compare the direct database `INSERT ... RETURNING ...` result with the ZTD result to tell whether the problem is the DB, the manifest, or the rewrite path.
- If the workspace is meant to reflect a source change, verify it resolves `rawsql-ts` from the local source tree instead of a registry copy.
- `afterDb` remains subset-based per row, rows are treated as an unordered multiset, row order is ignored, and volatile columns can stay out of the persistent case.
- If an AI-authored ZTD test fails, do not assume the prompt or case file is the only problem; `ztd-cli` or `rawsql-ts` can still be the source of the bug.
- A `user_id: null` symptom usually points at fixture manifest, metadata, or rewrite path trouble rather than the DB engine itself.
- When a dogfood workspace should reflect a source change, verify the local `rawsql-ts` checkout is being resolved instead of a registry copy.
- For `afterDb` false negatives, check the comparison path, row-order handling, multiset semantics, and any volatile columns you intentionally left out.
Read the nearest AGENTS.md files first.
Do not apply migrations automatically.
```

Add `--with-dogfooding` if you want `PROMPT_DOGFOOD.md` for prompt review.

The feature-first path is successful when:

- `users` is the next feature to add
- SQL, specs, and tests stay feature-local
- the same vocabulary appears in the README, AGENTS files, and tutorial docs

If you need the deeper change scenarios, use the linked source-repository guides when you are working from the monorepo checkout; this generated workspace may not contain `docs/`.
