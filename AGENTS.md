# Package Scope
- Applies to the entire repository subtree rooted at `./`.
- Defines repository-wide contract rules for SQL rewriting, ZTD testing, and contribution safety.
- Serves as the fallback contract when no deeper `AGENTS.md` overrides a rule.
- Serves as the canonical source for task routing and token-efficiency policy in this repository.

# Task Routing

## Default entrypoint
- Human requests SHOULD be handled through the `orchestrator` agent.
- Specialist agents SHOULD NOT be invoked directly by humans unless debugging the orchestration itself.
- The `orchestrator` agent MAY be invoked from either plan mode or normal prompt mode.

## Routing policy
- For code changes, bug fixes, refactors, parser behavior, SQL rewrite behavior, package behavior, or test failures:
  1. `pr_explorer`
  2. `implementer` if changes are needed
  3. `reviewer`
- For docs UX, first-run flows, self-usage, or ztd-cli workflow friction:
  1. `dogfooder`
  2. `reviewer` only if correctness or regression risk is involved
- For simple read-only questions, answer directly without spawning specialists unless scope is unclear.

## Scope discipline
- The first pass MUST identify the smallest affected package and nearest verification scope before broad repo reads.
- Root-wide verification MUST NOT be the first step unless the task is explicitly repo-wide.

# Token Efficiency

## REQUIRED
- Start from the smallest affected package, nearest tests, and nearest docs.
- Prefer `pnpm --filter <package>` scoped commands before workspace-wide commands.
- Summaries MUST name touched package(s), touched files, and chosen verification scope.
- Do not restate repository architecture unless it is necessary for the current task.
- Do not read broad docs sets when a package README or nearby test already answers the question.

## ESCALATION
- Escalate from scoped verification to root-wide verification only when:
  - multiple packages are changed
  - a shared package contract is changed
  - release-readiness is being claimed
  - scoped verification is insufficient to support the claim

## OUTPUT SHAPE
- Default reports SHOULD be concise and use:
  - Summary
  - Scope
  - Actions
  - Verification
  - Risks or Assumptions

# Plan Mode Guidance

- For non-trivial work, plan mode SHOULD use `orchestrator` as the entrypoint.
- Plan mode SHOULD stay read-only and produce the smallest defensible plan before execution.
- Specialist names SHOULD remain internal unless orchestration debugging is requested.

# Policy
## REQUIRED
- Claims in task reports MUST be backed by direct observation.
- Each reported observation MUST include the executed command, exit code, and key output excerpt.
- A failing behavior MUST be reproduced before applying a fix.
- Fix scope MUST follow one-hypothesis/one-fix.
- Reports for troubleshooting and recovery MUST use: `Observations`, `Changes`, `Verification`, `Assumptions`.
- SQL rewrites MUST use AST utilities (`SelectQueryParser`, `SelectAnalyzer`, `splitQueries`) when an AST path is available.
- Regex fallback for SQL rewrite MUST include an inline limitation comment and a tracking issue reference.
- Repository and application SQL MAY use CRUD statements when execution flows through the rewriter.
- Library code MUST NOT bypass rewrite pipelines.
- DDL files, fixtures, and row maps MUST stay consistent with `ztd.config.json` schema settings.
- Changes to schema/search-path behavior MUST update `ztd.config.json`.
- Contributions MUST use `pnpm` and `pnpm --filter <package>` for scoped commands.
- Identifiers, code comments, and documentation content MUST be written in English.
- Throwaway assets MUST be created under `./tmp`.
- Release-worthy changes MUST include a changeset.

## ALLOWED
- Test code MAY import deterministic, side-effect-free normalization/sanitization helpers from source modules.
- Application SQL MAY omit schema qualifiers when schema resolution is configured in `ztd.config.json`.

## PROHIBITED
- Guessing unobserved facts in analysis or reports.
- Bundling unrelated fixes into a single hypothesis/fix step.
- Executing physical schema mutations (`CREATE TABLE`, `ALTER TABLE`, seed `INSERT`) against pg-testkit connections.
- Hand-constructing `QueryResult` objects or mocking `Client#query` to bypass rewrite flow.
- Allowing demo helpers to accept non-array query params or drop named bindings silently.
- Manual formatting edits that bypass configured format/lint scripts.
- Editing package versions directly in `package.json`.
- Leaving debug statements in committed code.

# Mandatory Workflow
- Before opening or updating a PR, these commands MUST pass:
  - `pnpm lint`
  - `pnpm test` or `pnpm --filter <pkg> test`
  - `pnpm build`
- If SQL rewrite logic changes, benchmark commands MUST also run.
- When parser/formatter behavior changes, browser and docs demo bundle update workflow MUST run.

# Hygiene
- Temporary files under `./tmp` MUST be removed before completion unless converted into tracked tests.
- `CONTINUITY.md` MUST stay untracked, MUST be listed in `.gitignore`, and MUST NOT be staged or committed.

# AI SQL Tool Happy Paths
- Start SQL pipeline investigations with pnpm --filter @rawsql-ts/ztd-cli exec node -r ts-node/register -r tsconfig-paths/register packages/ztd-cli/src/index.ts query plan <sql-file>.
- If the question is optimizer-facing (materialization, scalar filter binding, stage ordering), run query plan before any telemetry or grep-style command.
- Follow with pnpm --filter @rawsql-ts/ztd-cli exec node -r ts-node/register -r tsconfig-paths/register packages/ztd-cli/src/index.ts perf run --dry-run ... when you need candidate recommendations or before/after evidence.
- Use query uses only for impact analysis and refactors. It is not the default path for runtime or optimizer debugging.
- Use telemetry only after the structural path is known and you need timing, export, or trace evidence. Telemetry is opt-in investigation tooling, not the first command.
- When dogfooding SQL pipeline behavior, prefer this order:
  1. query plan
  2. perf run --dry-run
  3. focused SQL/debug or integration verification
  4. query uses if the task expands into refactor impact
- Add or update dogfooding scenarios when a tool remains underused even though it exists. Current priority targets are telemetry and SQL/debug flows; query uses should grow through refactor-impact scenarios rather than optimizer scenarios.

# References
- Rationale and architecture: [DESIGN.md](./DESIGN.md)
- Operational procedures and troubleshooting: [DEV_NOTES.md](./DEV_NOTES.md)
