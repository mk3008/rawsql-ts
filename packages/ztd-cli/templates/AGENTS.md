# Project Guidance

Read `README.md` and the nearest `AGENTS.md` before editing files.

## Default Working Shape

- Use `src/features/<feature>` as the default change unit.
- Keep handwritten SQL, specs, and tests inside the feature that owns them.
- Treat `ztd/ddl` as human-owned DDL input.
- Do not apply migrations automatically.

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
