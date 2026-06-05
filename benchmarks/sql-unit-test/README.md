# SQL unit test benchmark helpers

This directory holds benchmark fixtures for the rawsql-ts SQL unit-test path.

Generated files under `tests/generated/` are benchmark inputs. The generator that used to live in this repository as `@rawsql-ts/ztd-cli` has moved to Ashiba, so this workspace no longer links a local `ztd` binary.

## Running the benchmarks

If `tests/generated/ztd-row-map.generated.ts` is present, run from the repository root:

```bash
pnpm bench:test
```

The helper script at `scripts/run-vitest.js` emits a clear skip message when generated fixtures are missing, so the benchmark command remains safe in fresh checkouts.
