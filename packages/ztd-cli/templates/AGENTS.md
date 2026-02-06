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
- Respect ownership boundaries: human-owned contracts must not be changed without explicit instruction.

## Runtime vs non-runtime

- Runtime assets live under "src/": executed/loaded by the application.
- Non-runtime assets live under "ztd/" and parts of "tests/": used for verification and generation.

## Human-owned vs AI-assisted (important)

Human-owned (do not change without explicit instruction):
- "ztd/ddl" (physical schema / DDL)
- "src/catalog/specs" (query contracts: params + DTO + semantics)
- "src/sql" (SQL assets; AI may propose patches, but do not rewrite intent)

AI-assisted (implementation and verification):
- "src/repositories"
- "src/catalog/runtime"
- "tests" (except "tests/generated")

Never touch by hand:
- "tests/generated"

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
