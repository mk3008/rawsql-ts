# src AGENTS

This directory is runtime application code.

## Boundaries

- Code under "src/" MUST NOT import from:
  - "tests/"
  - "tests/generated/"
  - any test-only helpers
- Runtime code MUST NOT depend on ZTD internals.
- Generated artifacts are test-only signals, not runtime dependencies.

## Implementation principles

- Keep modules small and explicit.
- Prefer explicit contracts over inference.
- Favor deterministic behavior and clear error surfaces.

## Verification (required)

After changes:
- Run the project typecheck command (example: "pnpm typecheck").
- Run relevant tests (example: "pnpm test" or a filtered command).

If you touched SQL contracts or catalog specs, run tests that exercise them.
