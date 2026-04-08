# Prompt Dogfooding

Use this file when you want to test the starter tutorial with an AI coding agent.

Run the prompts one at a time against a project created with `ztd init --starter`.

## Prompt 1: Add a feature

```text
Add a feature to this feature-first project.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Start with `npx ztd feature scaffold --table <table> --action <action>`.
Treat the project structure as Architecture as a Framework.
Every boundary folder exposes only `boundary.ts`, and child boundaries repeat the same rule.
Keep handwritten SQL, the feature boundary, and the query boundary inside `src/features/<feature-name>`.
Keep feature-boundary tests mock-based in `src/features/<feature-name>/tests/<feature-name>.boundary.test.ts`.
After you finish SQL and DTO edits, run `npx ztd feature tests scaffold --feature <feature-name>` to refresh `src/features/<feature-name>/queries/<query-name>/tests/generated/TEST_PLAN.md` and `analysis.json`, refresh `src/features/<feature-name>/queries/<query-name>/tests/boundary-ztd-types.ts`, keep the thin `src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` Vitest entrypoint in sync, and then keep the persistent case files under `src/features/<feature-name>/queries/<query-name>/tests/cases/` as human/AI-owned ZTD assets around the fixed app-level runner. `generated/*` is CLI-owned and refreshable, `cases/*` is human/AI-owned and kept, and the thin entrypoint is kept. Treat `tests/support/ztd/` as starter-owned shared support and read-only for feature-specific work. If `ztd-config` has already run, use `.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs. `beforeDb` and `afterDb` are pure fixture skeletons with schema-qualified table keys. The validation case may stay at the feature boundary, but the success case must execute through the fixed app-level ZTD runner. Do not put returned columns into the input fixture. Read `TEST_PLAN.md` and `analysis.json` before filling the persistent case files under `src/features/<feature-name>/queries/<query-name>/tests/cases/`. `afterDb` is subset-based per row, rows are treated as an unordered multiset, row order is ignored, and the verifier truncates tables named in `beforeDb` with `restart identity cascade` before seeding. After the cases are ready, run `npx vitest run src/features/<feature-name>/queries/<query-name>/tests/<query-name>.boundary.ztd.test.ts` to execute the ZTD query test. Do not edit `tests/support/ztd/` unless you are updating the starter-owned shared support.
If the returned result is null, stop and fix the scaffold or DDL instead of weakening the case.
Before writing the success-path assertion, inspect the current SQL and query boundary. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
Do not apply migrations automatically.
```

Troubleshooting reminder:

- If an AI-authored ZTD test fails, check the runtime path as well as the prompt and case file; `ztd-cli` or `rawsql-ts` can still be the source of the bug.
- If you see `user_id: null`, inspect the fixture manifest and rewrite path before weakening the case.
- Compare the direct database `INSERT ... RETURNING ...` result with the ZTD result so you can separate the DB from manifest or rewrite issues.
- Verify a dogfood workspace resolves `rawsql-ts` from the local source tree instead of a registry copy when you expect a source change to be reflected.
- For `afterDb` false negatives, remember that the comparison is subset-based per row, rows are treated as an unordered multiset, row order is ignored, and volatile columns can stay out of the persistent case.
- Treat `tests/generated/*` as CLI refresh output, not an AI edit target.

## Prompt 2: Fix a DDL change

```text
I changed the DDL for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Fix the tests and feature code that now fail.
Do not apply migrations automatically.
```

## Prompt 3: Fix a SQL change

```text
I changed the SQL for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Update the feature-local boundaries and tests that now fail.
Do not apply migrations automatically.
```

## Prompt 4: Fix a DTO change

```text
I changed the DTO shape for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Update the feature-local boundaries and tests that now fail.
Do not apply migrations automatically.
```

## Prompt 5: Prepare a migration

```text
I changed the DDL for users and need a migration artifact.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Generate or update the migration SQL, then fix the tests that fail.
Do not apply migrations automatically.
```

Record:

| Prompt | What changed | What the agent did | Notes |
| --- | --- | --- | --- |
| Add a feature | | | |
| Fix a DDL change | | | |
| Fix a SQL change | | | |
| Fix a DTO change | | | |
| Prepare a migration | | | |
