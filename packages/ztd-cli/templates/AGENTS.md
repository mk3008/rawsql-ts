# Workspace AGENTS

This repository uses directory-scoped AGENTS.
Rules live close to where the work happens.

## Rule precedence

- The closest "AGENTS.md" to the file being edited has the highest priority.
- Parent directories provide shared rules.
- Child directories should only describe deltas.

## Global non-negotiables

- Do not guess. If something is unknown, state "Not observed" and propose the next check.
- Do not edit generated artifacts unless explicitly instructed.
- SQL must be executable in a normal SQL client.
- SQL string concatenation/composition is forbidden.
- Special SQL syntax is forbidden.
- Positional SQL params (`$1`, `$2`, ...) are forbidden.
- CamelCase SQL aliases (for example `as "userId"`) are forbidden.
- Every catalog query must have a stable `query_id` and emit a trace event.

## Runtime vs non-runtime

- Runtime assets live under "src/": executed/loaded by the application.
- Non-runtime assets live under "ztd/" and parts of "tests/": used for verification and generation.

## Allowed edit scope

Human-owned (do not change without explicit instruction):
- `ztd/ddl/**`
- `src/catalog/specs/**`
- `src/sql/**`
- `src/repositories/**` method signatures
- `src/dto/**` (if present)

AI-owned glue (allowed):
- `src/catalog/runtime/**`
- repository implementation details under `src/repositories/**`
- `tests/**` except `tests/generated/**`

Never touch by hand:
- `tests/generated/**`

Forbidden patterns:
- SQL built by string concatenation/template stitching.
- Custom SQL syntax that does not run directly in SQL clients.
- Positional SQL params in `.sql` files.
- CamelCase aliases in SQL.

Trace requirement:
- Include `query_id` in every catalog query contract.
- Emit trace events with `query_id`, `phase`, `duration_ms`, `row_count`, `param_shape`, `error_summary`, `source`.

Workflow:
- Observe -> change -> verify (`pnpm typecheck`, `pnpm test`) -> report.

Prompt execution contract (project rule):
- When a prompt includes `Run: pwsh ...`, execute that command exactly before planning edits.
- If requested by the prompt, create a deterministic marker file under `tests/` first.
- If a marker is requested, confirm command output (`ok`) and marker file existence before proceeding.
- After required prompt commands are complete, continue the requested implementation task.
- Keep all edits within allowed scope.

## Where to read next

- "src/catalog/AGENTS.md": catalog layout and contract boundaries
- "src/repositories/AGENTS.md": repository responsibilities and restrictions
- "src/sql/AGENTS.md": SQL asset rules
- "tests/AGENTS.md": ZTD testing rules
- "ztd/ddl/AGENTS.md": DDL authoring rules

## Test environment guarantee (important)

- This workspace MUST be test-runnable immediately after initialization.
- `pnpm test` (or equivalent) must not fail due to missing configuration.
- Test runner configuration (e.g. vitest.config.ts) is considered part of the template contract.

If tests fail due to missing config, this is a template defect, not a user error.
- If a prompt includes an explicit command, run it first and verify output before additional edits.
