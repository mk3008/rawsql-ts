# ztd Onboarding Dogfooding

## Source issue
Issue #685

## Why it matters
Issue #685 originally changed the customer-facing onboarding path by inserting an AI-control bootstrap into the first-run Codex workflow. The current CLI no longer ships that bootstrap, so reviewers need evidence that the README Quickstart and starter tutorial still form a coherent path from fresh project creation to the first `smoke -> users` development step.

## What was run
- README Quickstart path in a fresh directory outside the monorepo workspace root.
- Tutorial review against `docs/guide/sql-first-end-to-end-tutorial.md`.
- Published-package path using `npm install -D @rawsql-ts/ztd-cli vitest typescript`.

## Exact order
1. `npm install -D @rawsql-ts/ztd-cli vitest typescript`
2. `npx ztd init --starter`
3. `.env.example` -> `.env`
4. `docker compose up -d`
5. `npx ztd ztd-config`
6. `npx vitest run`

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
  - gap: the published package immediately reported that AI-control guidance was installed for the starter flow and then hit a local `npm install` `spawn EPERM` during dependency sync. This behavior does not match the branch under review, where customer-facing AI-control guidance is removed.
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
- The exact README order is conceptually natural: package install -> starter scaffold -> env -> Docker -> generation -> tests.
- The README and starter scaffold are enough to locate `smoke` as the teaching example before the first AI-guided `smoke -> users` step.
- The starter scaffold still communicates that `src/features/smoke` is the teaching example and `src/features/users` is the next real feature.

## Where the removed bootstrap had helped
- It made the first AI-oriented onboarding step explicit right after scaffold creation.
- It gave a natural place to look before CRUD feature creation.

## Where the removed bootstrap was redundant or confusing
- The generated README and tutorial already describe the `smoke -> users` progression.
- The extra AI-control files made onboarding depend on text artifacts that were not required for the scaffolded commands.
- Published-package evidence can lag behind branch behavior, so bootstrap-specific claims mixed release-lag evidence with local-environment evidence.

## Tutorial starting conditions
- The tutorial starts after `ztd init --starter`.
- It is intentionally a scenario guide layered on top of the README first-run path.
- The `smoke -> users` structure remains natural and consistent with the README prompt.

## Tutorial consistency result
- The tutorial can start immediately after `ztd init --starter` when it is read as the AI-guided starter path.
- The tutorial flow from `src/features/smoke` to `src/features/users` remains coherent.
- The tutorial wording should avoid assuming AI-control files are present.

## What remains unverified
- The exact README Quickstart cannot yet be treated as a clean published-package proof for this branch because the published `@rawsql-ts/ztd-cli@0.22.5` package does not match the branch onboarding shape.
- The DB-backed path remains blocked in this local environment by Docker access and the previously documented `spawn EPERM` startup issue.
- CI or an alternate environment is still required to close the end-to-end Quickstart and tutorial execution path.

## Reviewer conclusion
- The onboarding order remains coherent without the AI-control bootstrap.
- The tutorial flow remains coherent, but its wording needs to stay centered on README/help/scaffold behavior instead of AI-control guidance.
- Current evidence is enough to review onboarding shape and wording, but not enough to mark the end-to-end onboarding execution path as fully verified.
