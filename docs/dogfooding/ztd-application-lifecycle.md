# Application Lifecycle Dogfooding

This guide records the CRUD dogfooding loop for the starter scaffold.

The goal is to confirm that an AI agent can read `AGENTS.md` after you opt in with `ztd agents init`, follow the starter prompt, and add a new `users` feature without being pushed into shared extraction or migration execution.

## What to use

- `ztd init --starter`
- `ztd agents init`
- `src/features/smoke`
- `src/features/users`
- `packages/ztd-cli/README.md`
- `packages/ztd-cli/templates/PROMPT_DOGFOOD.md`

## Prompt used for CRUD

```text
Add a users feature to this feature-first project.
Read the nearest AGENTS.md files first.
Keep handwritten SQL, specs, and tests inside src/features/users.
Do not apply migrations automatically.
```

## What should happen

1. The agent reads `AGENTS.md` and the starter README after visible AGENTS are installed.
2. The agent uses `src/features/smoke` as the model.
3. The agent adds `src/features/users`.
4. The agent keeps SQL, spec, and tests feature-local.
5. The next verification command is `vitest`.

## Evidence to capture

- the generated project root path
- the exact prompt
- the feature path the agent created
- the commands the agent chose
- whether the agent tried to leave the feature folder
- whether `smoke` was enough as a teaching example

## Pass criteria

- the agent can add `users` without asking for extra layout guidance
- the agent keeps handwritten work inside the feature folder
- the next command is a normal test run, not a migration command
- the workflow still feels natural after `smoke` is deleted
