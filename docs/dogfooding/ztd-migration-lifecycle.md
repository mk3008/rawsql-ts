# Migration Lifecycle Dogfooding

This guide records the DDL, SQL, and DTO repair loops for the starter scaffold.

The goal is to confirm that a prompt can point an AI agent at the right files, let the agent repair the breakage, and keep the change local to the `users` feature.

## Scenario set

Use one `users` project and try these prompts in order:

1. DDL change
2. SQL change
3. DTO change
4. migration artifact creation

These prompts are intended to be copied into a separate AI instance, so the tutorial can verify whether the prompt wording, generated README, and CLI help are sufficient without manual repair in between.

## Preferred CLI by scenario

- DDL repair: `npx ztd query uses column users.email --scope-dir src/features/users/persistence --any-schema --view detail`
- SQL repair: `npx ztd model-gen --probe-mode ztd src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts`
- DTO repair: `npx vitest run`
- migration artifact creation: `npx ztd ztd-config`, optionally `npx ztd ddl pull --url <target-db-url>` to inspect the target, then `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to generate review output plus SQL; if you hand-edit the migration afterward, run `npx ztd ddl risk --file tmp/users.diff.sql` to re-evaluate the final SQL with the same structured risk contract
- tuning: use the separate perf guide, not this starter lifecycle

`ZTD_DB_URL` is the only implicit database owned by ztd-cli. Use `--url` or a full `--db-*` flag set for any other inspection target.

## DDL change prompt

```text
I changed the DDL for users.
Start with the generated README and CLI help.
Run `npx ztd query uses column users.email --scope-dir src/features/users/persistence --any-schema --view detail` to find the affected SQL files before you edit anything. The feature folder is one narrowed scan scope inside the normal project-wide discovery flow.
Fix the tests and feature code that now fail.
Do not apply migrations automatically.
```

## SQL change prompt

```text
I changed the SQL for users.
Start with the generated README and CLI help.
The starter DDL uses the `users` table, so keep the SQL on that table and do not invent a `user` table.
Use `npx ztd model-gen --probe-mode ztd src/features/users/persistence/users.sql --out src/features/users/persistence/users.spec.ts` to refresh the spec, then update the feature-local tests that now fail. In VSA layouts, `model-gen` derives the contract from the SQL file location first, so `--sql-root` is only a compatibility helper for older shared SQL roots.
Keep `ZTD_DB_URL` set in the same shell when you run Vitest.
Do not apply migrations automatically.
```

## DTO change prompt

```text
I changed the DTO shape for users.
Start with the generated README and CLI help.
Update the application and tests that now fail.
Do not apply migrations automatically.
```

## Migration prompt

```text
I changed the DDL for users and need a migration artifact.
Start with the generated README and CLI help.
Run `npx ztd ztd-config`.
Optionally run `npx ztd ddl pull --url <target-db-url>` to inspect the target first.
Run `npx ztd ddl diff --url <target-db-url> --out tmp/users.diff.sql` to generate review output plus SQL, read the logical summary first, inspect the structured risks second, and if you hand-edit the SQL run `npx ztd ddl risk --file tmp/users.diff.sql` before you fix the tests that fail.
Do not apply migrations automatically.
```

## What to verify

- the agent starts from the feature folder instead of `src/catalog`
- the agent picks the right file type for the change
- the agent repairs tests before widening the scope
- the agent keeps the fix local to the `users` feature
- the agent uses CLI output to identify the affected files instead of guessing them
- `vitest` passes again after the repair
- the agent can prepare a migration artifact without pretending to deploy it

## Evidence to capture

- the generated project root path
- the prompt that was used
- the files the agent changed
- the test command that was run
- whether the agent asked for extra layout help
- whether the scaffold vocabulary matched the prompt vocabulary
- whether the migration prompt stayed explicit about not applying migrations automatically
- whether the final hand-edited SQL was re-evaluated with `ztd ddl risk --file ...`
