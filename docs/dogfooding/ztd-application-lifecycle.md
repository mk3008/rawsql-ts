# Application Lifecycle Dogfooding

This guide records the CRUD dogfooding loop for the starter scaffold.

The goal is to confirm that an AI agent can work from the generated README and CLI scaffold, follow the starter prompt, and add a new `users` feature without being pushed into shared extraction or migration execution.

## What to use

- `ztd init --starter`
- `src/features/smoke`
- `src/features/users`
- `packages/ztd-cli/README.md`
- `packages/ztd-cli/templates/README.md`

## Prompt used for CRUD

```text
Add a users feature to this feature-first project.
Start with the generated README and CLI help.
Keep handwritten SQL, specs, and tests inside src/features/users.
Do not apply migrations automatically.
```

## What should happen

1. The agent reads the starter README and uses CLI help when it needs command details.
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
