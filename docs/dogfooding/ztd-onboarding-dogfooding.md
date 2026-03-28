# ztd Onboarding Dogfooding

## Source issue
Issue #685

## Why it matters
Issue #685 changes the customer-facing onboarding path by inserting `ztd agents init` into the first-run Codex workflow. Verifying only the managed bootstrap files is not enough; reviewers also need evidence that the README Quickstart and the starter tutorial still form a coherent path from fresh project creation to the first `smoke -> users` development step.

## What was run
- README Quickstart path in a fresh directory outside the monorepo workspace root.
- Tutorial review against `docs/guide/sql-first-end-to-end-tutorial.md`.
- Published-package path using `npm install -D @rawsql-ts/ztd-cli vitest typescript`.

## Exact order
1. `npm install -D @rawsql-ts/ztd-cli vitest typescript`
2. `npx ztd init --starter`
3. `npx ztd agents init`
4. `.env.example` -> `.env`
5. `docker compose up -d`
6. `npx ztd ztd-config`
7. `npx vitest run`

## README Quickstart environment
- OS: Windows
- shell: PowerShell
- install location: fresh directory outside `rawsql-ts/`
- npm cache override: project-local cache under `.npm-cache/`
- installed published package: `@rawsql-ts/ztd-cli@0.22.5`

## README Quickstart step-by-step outcome
- `npm install -D @rawsql-ts/ztd-cli vitest typescript`
  - status: `done`
  - evidence: install succeeded in the fresh external directory when npm cache was redirected to a project-local folder.
  - gap: the same command failed inside `rawsql-ts/tmp/` because the parent workspace leaked `workspace:*` dependencies into the install path, so reviewer judgment should use the external fresh directory result instead.
- `npx ztd init --starter`
  - status: `partial`
  - evidence: scaffold creation completed and generated the starter project files.
  - gap: the published package immediately reported `Visible AGENTS.md files installed for the starter flow` and then hit a local `npm install` `spawn EPERM` during dependency sync. This behavior does not match the branch under review, where the Codex bootstrap is supposed to stay opt-in.
- `npx ztd agents init`
  - status: `not done`
  - evidence: the published package exposed `ztd agents install` but not `ztd agents init`.
  - gap: the exact README command cannot be validated against the currently published npm package because the branch behavior has not been published yet.
- `.env.example` -> `.env`
  - status: `not done`
  - evidence: the scaffold generated `compose.yaml`, but no `.env.example` file was present in the published-package run.
  - gap: this blocks the exact README copy step in the published-package path.
- `docker compose up -d`
  - status: `not done`
  - evidence: Docker CLI was present.
  - gap: the local Docker path failed with `Access is denied` on the Docker engine pipe, so the DB-backed path remains environment-blocked here.
- `npx ztd ztd-config`
  - status: `not done`
  - evidence: command resolution worked.
  - gap: the published-package scaffold still required `@rawsql-ts/testkit-core` to be installed before `ztd-config` could run, which contradicts the branch README claim that the starter scaffold already includes the required support for a fresh standalone project.
- `npx vitest run`
  - status: `not done`
  - evidence: `vitest` resolved from the fresh project.
  - gap: the local Windows environment still hit `spawn EPERM` during Vitest startup, consistent with the earlier investigation.

## What succeeded
- The exact README order is conceptually natural: package install -> starter scaffold -> Codex bootstrap -> env -> Docker -> generation -> tests.
- The new bootstrap belongs immediately after `ztd init --starter`, before the first AI-guided `smoke -> users` step.
- The starter scaffold still communicates that `src/features/smoke` is the teaching example and `src/features/users` is the next real feature.

## Where the new bootstrap helped
- It makes the first AI-oriented onboarding step explicit right after scaffold creation.
- It keeps the `smoke -> users` progression aligned with the README prompt and the tutorial narrative.
- It gives a natural place to read nearest guidance before CRUD feature creation, instead of introducing the bootstrap later in the flow.

## Where the new bootstrap was redundant or confusing
- The published `packages/ztd-cli/README.md` and released `AGENTS.md` guidance still reflect the older wording where `npx ztd agents init` looked like a later optional step, even though this branch already updates `packages/ztd-cli/README.md` to the `if you skipped that step` wording.
- The tutorial still described `ztd agents init` as optional visible `AGENTS.md` guidance, which is stale after the Codex bootstrap change.
- The published npm package `0.22.5` does not yet expose the same onboarding shape as this branch, so exact README Quickstart dogfooding against the published package currently mixes release-lag evidence with local-environment evidence.

## Tutorial starting conditions
- The tutorial starts after `ztd init --starter`.
- It is intentionally a scenario guide layered on top of the README first-run path.
- The `smoke -> users` structure remains natural and consistent with the README prompt.

## Tutorial consistency result
- `ztd agents init` belongs immediately after `ztd init --starter` when the tutorial is read as the AI-guided starter path.
- The tutorial flow from `src/features/smoke` to `src/features/users` remains coherent.
- The tutorial wording was partially stale because it still talked about visible `AGENTS.md` only, not the wider Codex bootstrap.

## What remains unverified
- The exact README Quickstart cannot yet be treated as a clean published-package proof for this branch because the published `@rawsql-ts/ztd-cli@0.22.5` package does not match the new `ztd agents init` onboarding shape.
- The DB-backed path remains blocked in this local environment by Docker access and the previously documented `spawn EPERM` startup issue.
- CI or an alternate environment is still required to close the end-to-end Quickstart and tutorial execution path.

## Reviewer conclusion
- The onboarding order introduced by Issue #685 is coherent, and placing `ztd agents init` immediately after starter scaffold creation is natural.
- The tutorial flow remains coherent, but its wording needed to be updated from visible-AGENTS phrasing to Codex-bootstrap phrasing.
- Current evidence is enough to review onboarding shape and wording, but not enough to mark the end-to-end onboarding execution path as fully verified.
