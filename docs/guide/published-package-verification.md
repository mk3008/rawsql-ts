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
- Phase B proves the stronger consumer smoke:
  - `npx ztd ztd-config`
  - `npm run test`
  - TypeScript compile checks for both default and Node16 settings

## What this check does not prove

- This check does **not** fully emulate npm registry resolution for every unpublished transitive dependency.
- A real post-publish smoke check is still required.
- Do not use this to claim that every package combination is already registry-valid.

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
6. Run Phase B: `npx ztd ztd-config`, `npm run test`, and TypeScript compile checks
7. Write a machine-readable summary to `tmp/published-package-check/summary.json`

## How to interpret failures

- Pack inspection fails because a tarball still contains `workspace:` references.
  - Treat this as a packaging/release bug.
- Phase A fails before `ztd-config`.
  - Treat this as a packaging or npm-primary-path regression.
- Phase B fails after the npm-first setup completed.
  - Treat this as a published-package-mode release gap.
  - The local-source developer path may still be healthy.
- The standalone smoke app passes, but local-source dogfooding fails.
  - Treat that as a developer-mode problem, not a packaging problem.

## Recommended policy

Use both checks before release work is considered healthy:

- `Local-source developer mode`
  - Answers: can we dogfood unreleased changes from source?
- `Published-package verification before release`
  - Answers: are the packed artifacts internally consistent enough for release preparation?

Only a real npm publish can fully answer the end-user registry path, but this check removes most avoidable surprises before that point.
