# Generated-Project Verification Before Merge

Use this guide when you change the scaffold or layout that `ztd-cli` writes into a fresh project.

This check is about the project that `ztd init` and `ztd feature scaffold` actually generate, not the packed npm artifact path. It answers a narrower question than the published-package check:

1. Can a brand-new starter project be created from the current source checkout?
2. Can the generated project immediately scaffold a real feature slice?
3. Can the generated project regenerate config and run its starter tests?

## What this check proves

- `ztd init --starter` can create a fresh project from the current source checkout.
- The generated starter project can install dependencies and run its starter smoke tests.
- `ztd feature scaffold --table users --action insert` still produces a runnable feature slice in that project.
- `ztd ztd-config` still works after the scaffolded feature is added.
- The generated project can still run `pnpm test` after the scaffold and config pass.

## What this check does not prove

- It does **not** prove the published npm consumer path.
- It does **not** replace [Published-Package Verification Before Release](./published-package-verification.md).
- It does **not** validate every feature shape or database scenario.

## Canonical command

Run this from the repository root:

```bash
pnpm verify:generated-project-mode
```

The script will:

1. Build the workspace packages needed by the local-source scaffold path.
2. Create a fresh starter project under `tmp/generated-project-check/`.
3. Run `ztd init --starter --yes --local-source-root <repo-root>`.
4. Run `ztd feature scaffold --table users --action insert` inside the generated project.
5. Run `ztd ztd-config`.
6. Start a disposable Postgres 18 container on an available local port and wait for it to accept connections.
7. Run `pnpm test`.
8. Stop the disposable Postgres container.
9. Write a machine-readable summary to `tmp/generated-project-check/summary.json`.

## Target scenarios

Use this lane when the change touches any of the following:

- `packages/ztd-cli/src/commands/init.ts`
- `packages/ztd-cli/src/commands/feature.ts`
- `packages/ztd-cli/templates/**`
- `packages/ztd-cli/tests/init.command.test.ts`
- `packages/ztd-cli/tests/featureScaffold.unit.test.ts`
- `packages/ztd-cli/tests/cliCommands.test.ts`
- `packages/ztd-cli/README.md`

Those files control the generated scaffold and the contract that the generated project must satisfy.

## How to interpret failures

- `ztd init` fails.
  - Treat this as a scaffold or local-source install regression.
- `feature scaffold` fails.
  - Treat this as a scaffold contract or layout regression.
- `ztd ztd-config` fails after scaffold succeeds.
  - Treat this as a generated-artifact or DDL/layout regression.
- `pnpm test` fails after the project generated successfully.
  - Treat this as a starter-project runtime regression.

## Recommended policy

Use this generated-project check before you call a scaffold/layout PR ready for review.
For release work, keep the published-package check in place as well:

- `Generated-project verification`
  - Answers: can the current source checkout still generate a runnable starter project?
- `Published-package verification`
  - Answers: does the packed npm consumer path still behave?

These checks overlap, but they are not interchangeable.
