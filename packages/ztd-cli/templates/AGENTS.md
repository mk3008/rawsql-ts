# Project Guidance

Read `README.md` and the nearest `AGENTS.md` before editing files.

## Default Working Shape

- Use `src/features/<feature>` as the default change unit.
- Keep handwritten SQL, specs, and tests inside the feature that owns them.
- Treat `db/ddl` as human-owned DDL input.
- Treat `.ztd/` as the tool-managed workspace for generated and support assets.
- Do not apply migrations automatically.
- When a request says `ZTD-format tests`, treat that as feature-local SQL verification through the project's ZTD testkit against the real database engine, not a mocked executor.
- Validation-only tests are fine for boundary checks, but any success-path insert/update/delete/list test must execute the SQL path, not only inspect property values.
- For success-path insert tests, keep generated or returned columns such as `user_id` out of the input fixture. Assert returned values only after the DB-backed execution finishes.
- If a returned id comes back `null`, treat that as a scaffold or DDL mismatch and stop. Do not paper over it by loosening the success-path schema or adding fake seed rows.
- Before writing the success-path assertion, inspect the scaffolded SQL and QuerySpec contract. If the scaffold does not actually return a non-null id, report the mismatch instead of inventing fixture data or schema overrides.
- For new feature work, run `ztd feature scaffold` first, then after SQL and DTO edits settle run `ztd feature tests scaffold --feature <feature-name>` to refresh `tests/ztd/generated/TEST_PLAN.md` and `analysis.json` while keeping AI-authored cases in `tests/ztd/cases/`.

## Safe Next Steps

- After DDL changes, rerun `npx ztd ztd-config`, `npx ztd lint`, and `npx vitest run`.
- After SQL-only changes, rerun the affected tests and regenerate specs when needed.
- If the request is broad, start with a plan before editing many files.

## Codex Bootstrap

If this project was set up with `ztd agents init`, use:

- `.codex/agents/planning.md` to scope the next change
- `.codex/agents/troubleshooting.md` to debug setup or contract drift
- `.codex/agents/next-steps.md` to suggest the next safe command or feature task

The first useful request after setup is usually: "Read the nearest AGENTS files, inspect `src/features/smoke`, and plan the next `users` feature."

## SQL Shadowing Troubleshooting
- When a SQL-backed test fails, first determine whether the query is shadowing the intended SQL path or accidentally touching a physical table directly.
- If the SQL is not shadowing correctly, check the failure in this order:
  1. DDL and fixture sync
  2. Fixture selection or specification
  3. repository bug or rewriter bug
- Do not use DDL execution as a repair path for ZTD validation failures.
- If the database is reachable, treat relation or missing-table errors as a shadowing, fixture, or repository problem before considering schema changes.
- SQL shadowing diagnostics MUST prefer repository evidence over manual database repair.
