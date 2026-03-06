# Published-Package Verification Before Release

Use this guide when you need to validate the published-package happy path **before** pushing packages to npm.

This is not a perfect substitute for a real registry publish. It is a local verification layer that answers two practical questions:

1. Did `pnpm pack` rewrite workspace protocol dependencies to concrete semver ranges?
2. Does the packed `@rawsql-ts/ztd-cli` tarball still reach a green standalone smoke run?

## What this check proves

- Release builds complete for the packages needed by the published-package path.
- Packed tarballs do not leak `workspace:*`, `workspace:^`, or similar references.
- A standalone app can install the packed `@rawsql-ts/ztd-cli` tarball and complete:
  - `ztd init --yes`
  - `ztd ztd-config`
  - `pnpm test`

## What this check does not prove

- It does **not** fully emulate npm registry resolution for every unpublished transitive dependency.
- It does **not** replace a real post-publish smoke check.
- It should not be used to claim that every package combination is already registry-valid.

## Canonical command

Run this from the repository root:

```bash
pnpm verify:published-package-mode
```

The script will:

1. Run `pnpm build:publish`
2. Pack the publishable packages into `tmp/published-package-check/tarballs`
3. Inspect each packed `package.json` for leaked `workspace:` references
4. Create a standalone app under `tmp/published-package-check/standalone-app`
5. Install the packed `@rawsql-ts/ztd-cli` tarball there
6. Run `ztd init --yes`, `ztd ztd-config`, and `pnpm test`
7. Write a machine-readable summary to `tmp/published-package-check/summary.json`

## How to interpret failures

- Pack inspection fails because a tarball still contains `workspace:` references.
  - Treat this as a packaging/release bug.
- The standalone app fails during `pnpm add` or later install steps because an unpublished transitive dependency still expects the public registry.
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
