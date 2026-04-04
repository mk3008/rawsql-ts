# Prompt Dogfooding

Use this file when you want to test the starter tutorial with an AI coding agent.

Run the prompts one at a time against a project created with `ztd init --starter`.

## Prompt 1: Add a feature

```text
Add a feature to this feature-first project.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Start with `npx ztd feature scaffold --table <table> --action <action>`.
Keep handwritten SQL, the feature entrypoint, and QuerySpec inside `src/features/<feature-name>`.
Keep entryspec tests mock-based in `src/features/<feature-name>/tests/<feature-name>.entryspec.test.ts`.
After you finish SQL and DTO edits, run `npx ztd feature tests scaffold --feature <feature-name>` to refresh `src/features/<feature-name>/<query-name>/tests/generated/TEST_PLAN.md` and `analysis.json`, keep the thin `src/features/<feature-name>/<query-name>/tests/<query-name>.queryspec.ztd.test.ts` Vitest entrypoint in sync, and then fill the persistent case files under `src/features/<feature-name>/<query-name>/tests/cases/`. If `ztd-config` has already run, use `src/features/<feature-name>/.ztd/generated/ztd-fixture-manifest.generated.ts` as the source for `tableDefinitions` and any fixture-shape hints the case needs. `beforeDb` and `afterDb` are pure fixture skeletons with schema-qualified table keys. The validation case may stay at the entry boundary, but the success case must execute through the fixed app-level ZTD runner. Do not put returned columns into the input fixture. Read `TEST_PLAN.md` and `analysis.json` before filling the persistent case files under `src/features/<feature-name>/<query-name>/tests/cases/`. `afterDb` compares the rows you spell out after normalizing object key order, while row order itself is ignored. After the cases are ready, run `npx vitest run src/features/<feature-name>/<query-name>/tests/<query-name>.queryspec.ztd.test.ts` to execute the ZTD query test.
If the returned result is null, stop and fix the scaffold or DDL instead of weakening the case.
Before writing the success-path assertion, inspect the current SQL and QuerySpec. If the scaffold does not actually return the expected result shape, report that mismatch instead of inventing fixture data or schema overrides.
Do not apply migrations automatically.
```

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
Update the feature-local spec and tests that now fail.
Do not apply migrations automatically.
```

## Prompt 4: Fix a DTO change

```text
I changed the DTO shape for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.ztd/agents/*` if present.
Update the application and tests that now fail.
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
