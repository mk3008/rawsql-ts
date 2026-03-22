# Published-Package Verification Before Release

Use this guide when you need to validate the published-package happy path **before** pushing packages to npm.

This is not a perfect substitute for a real registry publish. It is a local verification layer that answers two practical questions:

1. Did `pnpm pack` rewrite workspace protocol dependencies to concrete semver ranges?
2. Does the packed `@rawsql-ts/ztd-cli` tarball still reach a green npm-first standalone smoke run?

## What this check proves

- Release builds complete for the packages needed by the published-package path.
- Packed tarballs do not leak `workspace:*`, `workspace:^`, or similar references.
- Phase A proves the packaging / npm primary path gate:
  - the tarball installs with `npm install`
  - `npx ztd init --yes` completes
  - the generated completion message stays on the npm primary path
  - follow-up `npm install` still works
- Phase B proves the first test quality gate:
  - `npx ztd ztd-config`
  - `npx ztd query lint --help` still exposes `--rules`
  - `npx ztd query lint --rules join-direction <sql-file>` parses on the packed CLI path
  - `npm run test`
  - the generated scaffold reaches a passing first smoke test on the npm-first consumer path
  - TypeScript compile checks for both default and Node16 settings as follow-up smoke coverage

## What this check does not prove

- This check does **not** fully emulate npm registry resolution for every unpublished transitive dependency.
- A real post-publish smoke check is still required.
- Do not use this to claim that every package combination is already registry-valid.
- When Further Reading docs mention `query lint --rules join-direction`, a real post-publish smoke check should also confirm that `npx ztd query lint --help` exposes `--rules <list>` on the published package.

## Canonical command

Run this from the repository root:

```bash
pnpm verify:published-package-mode
```

The script will:

1. Run `pnpm build:publish`
2. Pack the publishable packages into `tmp/published-package-check/tarballs`
3. Inspect each packed `package.json` for leaked `workspace:` references
4. Create a standalone app under `tmp/published-package-check/packages/npm-primary-path`
5. Run Phase A: `npm install`, `npx ztd init --yes`, completion-message assertions, and follow-up `npm install`
6. Run Phase B: `npx ztd ztd-config`, `npx ztd query lint --help`, `npx ztd query lint --rules join-direction <sql-file>`, `npm run test`, and TypeScript compile checks
7. Write a machine-readable summary to `tmp/published-package-check/summary.json`

## How to interpret failures

- Pack inspection fails because a tarball still contains `workspace:` references.
  - Treat this as a packaging/release bug.
- Phase A fails before `ztd-config`.
  - Treat this as a packaging or npm-primary-path regression.
- Phase B fails after the npm-first setup completed.
  - Treat this as a first test quality gate regression on the published-package path.
  - This now includes command-surface regressions where docs mention `query lint --rules join-direction` but the packed CLI no longer accepts `--rules`.
  - The local-source developer path may still be healthy.
- The standalone smoke app passes, but local-source dogfooding fails.
  - Treat that as a developer-mode problem, not a packaging problem.

## First test definition

For this verification, `first test` means the generated scaffold's minimal smoke test passes after the npm-first setup flow.

- It is the test path exercised by `npm install -> ztd init -> npx ztd ztd-config -> npm run test`.
- It is **not** a full integration suite.
- It does **not** require every SQL-backed DB test to pass.
- It exists to prove that consumer onboarding reaches visible value, not just successful command execution.

## Recommended policy

Use both checks before release work is considered healthy:

- `Local-source developer mode`
  - Answers: can we dogfood unreleased changes from source?
- `Published-package verification before release`
  - Answers: are the packed artifacts internally consistent enough for release preparation, and does the first generated test pass on the consumer onboarding path?

## Release checklist

Treat this document as the canonical pre-release policy for the npm consumer path.

- `pnpm verify:published-package-mode` is green.
- The consumer path confirms `first test passes`.
- The generated scaffold and the verification path still match the intended onboarding flow.

Only a real npm publish can fully answer the end-user registry path, but this check removes most avoidable surprises before that point.
