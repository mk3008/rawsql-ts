# Prompt Dogfooding

Use this file when you want to test the starter tutorial with an AI coding agent.

Run the prompts one at a time against a project created with `ztd init --starter`.

## Prompt 1: Add a feature

```text
Add a users insert feature to this feature-first project.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.agents/skills/*` if present.
Start with `npx ztd feature scaffold --table users --action insert`.
Keep handwritten SQL and the feature entrypoint inside src/features/users-insert.
Add the two tests in src/features/users-insert/tests as the follow-up step.
Do not apply migrations automatically.
```

## Prompt 2: Fix a DDL change

```text
I changed the DDL for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.agents/skills/*` if present.
Fix the tests and feature code that now fail.
Do not apply migrations automatically.
```

## Prompt 3: Fix a SQL change

```text
I changed the SQL for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.agents/skills/*` if present.
Update the feature-local spec and tests that now fail.
Do not apply migrations automatically.
```

## Prompt 4: Fix a DTO change

```text
I changed the DTO shape for users.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.agents/skills/*` if present.
Update the application and tests that now fail.
Do not apply migrations automatically.
```

## Prompt 5: Prepare a migration

```text
I changed the DDL for users and need a migration artifact.
Read the nearest AGENTS.md files first. Then read `.codex/agents/*` and `.agents/skills/*` if present.
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
