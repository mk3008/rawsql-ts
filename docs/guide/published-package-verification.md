# Published-Package Verification Before Release

Use this guide when you need to validate rawsql-ts package artifacts before publishing to npm.

This is not a perfect substitute for a real registry publish. It is a local verification layer that answers two practical questions:

1. Did `pnpm pack` rewrite workspace protocol dependencies to concrete semver ranges?
2. Do the packed tarballs install and import from a standalone npm consumer project?

## What this check proves

- Release builds complete for publishable rawsql-ts packages.
- Packed tarballs include their declared entrypoints and `dist/` output.
- Packed tarballs do not leak `workspace:*`, `workspace:^`, or similar references.
- A standalone npm app can install the packed packages.
- The `rawsql-ts` getting-started smoke imports `DynamicQueryBuilder` and `SqlFormatter` from the packed artifact.

## What this check does not prove

- This check does not emulate every npm registry resolution edge case.
- A real post-publish smoke check is still required.
- Ashiba CLI scaffold and lifecycle checks are owned by the Ashiba repository, not by this rawsql-ts verification script.

## Canonical command

Run this from the repository root:

```bash
pnpm verify:published-package-mode
```

The script will:

1. Run `pnpm build:publish`.
2. Pack publishable packages into `tmp/published-package-check/tarballs`.
3. Inspect each packed `package.json` for leaked `workspace:` references.
4. Install the tarballs into a standalone app under `tmp/published-package-check/packages/packed-install`.
5. Run a rawsql-ts getting-started smoke under `tmp/published-package-check/packages/rawsql-ts-getting-started`.
6. Write a machine-readable summary to `tmp/published-package-check/summary.json`.

## How to interpret failures

- Pack inspection fails because a tarball still contains `workspace:` references.
  - Treat this as a packaging/release bug.
- The standalone install fails.
  - Treat this as a published dependency or manifest bug.
- The rawsql-ts getting-started smoke fails.
  - Treat this as a package entrypoint or runtime packaging regression.

## Recommended policy

Use `pnpm verify:published-package-mode` before release work is considered healthy.

Only a real npm publish can fully answer the end-user registry path, but this check removes most avoidable surprises before that point.
