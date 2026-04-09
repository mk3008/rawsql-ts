# ztd-cli Quality Gates

`ztd-cli` uses weighted gate timing so local commits stay fast without dropping important coverage.

## Essential

Run on every `ztd-cli`-scoped pre-commit and PR check.

- `typecheck`
- `build`
- `lint`
- scaffold and CLI contract tests
- pre-commit policy tests

These gates protect user-facing command behavior and generated-project expectations.

## Soft Gate

Run on a nightly schedule instead of blocking every local commit or PR.

- `tests/repoGuidance.unit.test.ts`
- `tests/intentProcedure.docs.test.ts`
- `tests/perfBenchmark.unit.test.ts`
- `tests/perfSandbox.unit.test.ts`
- `tests/queryLint.unit.test.ts`

These lanes stay visible, but they are intentionally not part of the always-blocking gate.
