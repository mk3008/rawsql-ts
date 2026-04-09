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
Broader CLI integration scenarios still run in the package-level test lanes outside the always-blocking gate.

## Soft Gate

Run on a nightly schedule instead of blocking every local commit or PR.

- `tests/repoGuidance.unit.test.ts`
- `tests/intentProcedure.docs.test.ts`
- `tests/perfBenchmark.unit.test.ts`
- `tests/perfSandbox.unit.test.ts`
- `tests/queryLint.unit.test.ts`

These lanes stay visible, but they are intentionally not part of the always-blocking gate.

## Release Readiness

`release-readiness` is a separate blocking PR check for release-affecting changes.

It is intended for changes that are more likely to break publishability than ordinary unit-level regressions.
The check name stays stable so it can be configured as a required status check in GitHub branch protection.

### Trigger Heuristics

The PR-side gate runs full release-readiness validation when changed files match at least one of these categories:

- scaffold or generated-project layout paths such as `packages/ztd-cli/templates/` and `packages/ztd-cli/src/commands/init.ts`
- package publish-shape paths such as `packages/*/package.json` and package `CHANGELOG.md`
- publish workflow and publish helper paths under `.github/workflows/`, `.github/actions/setup-publish-runtime/`, and `scripts/verify-published-package-mode.mjs`
- release-note paths under `.changeset/`

PRs that do not match these heuristics still receive the `release-readiness` check, but it exits successfully without running the heavier publish smoke lane.

### What The Check Proves

When the PR is release-affecting, `release-readiness` validates:

- the release runtime on Node 24 with a blocking npm minimum of `11.5.1`
- published-package smoke through `pnpm verify:published-package-mode`
- packed tarball `dist/` presence
- manifest entrypoint and `exports` consistency
- npm-primary-path scaffold behavior through the packaged CLI path

Runtime-version mismatches fail fast in setup instead of surfacing as warning-only diagnostics in this gate.
Publish-path failures also fail fast because the packed-package smoke step exits non-zero on missing `dist`, broken entrypoints, or broken packaged CLI flows.
