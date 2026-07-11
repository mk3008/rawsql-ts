---
name: rawsql-task-orchestrator
description: Assess and dispatch rawsql-ts developer tasks by tracing repository impact, concept and package boundaries, verification cost, difficulty, risk, model and reasoning effort, and Codex worktree requirements. Use when a new rawsql-ts issue, bug, feature, refactor, investigation, CI failure, review request, migration, or documentation change must be analyzed before action or handed to a new Codex task.
---

# rawsql-ts Task Orchestrator

Keep the orchestration task focused on decisions and evidence. Delegate implementation to a user-owned Codex task; use internal subagents only for bounded exploration, verification, or independent review.

For parent-worker lifecycle control, use the globally installed
`$minimal-orchestration` skill. This skill owns role identity, ledger state,
progress rendering, recovery, stale handling, and Runtime Adjudicator packets;
this rawsql-ts skill owns only repository impact, routing, and verification
selection.

For broad or uncertain blast-radius analysis, delegate fact gathering to the read-only `impact-explorer` custom agent and keep final classification and dispatch decisions in the parent orchestration task.

## 1. Establish the base

1. Read root and applicable nested `AGENTS.md` files.
2. Refresh remote refs when network access is allowed, then record the canonical repository and base SHA for current `origin/main`. Also decide whether the request continues an existing task or starts unrelated work.
3. Read the source issue, PR, failure log, or user request. Separate the objective from any proposed tactic.
4. Do not treat ignored build output or an old local directory as a live package. Confirm ownership with tracked files and workspace metadata.

## 2. Map impact

Report each relevant surface, including `none` when checked and unaffected:

- packages and reverse dependents;
- public API, SQL/AST/model output, compatibility, and Changeset classification;
- parser, analyzer, formatter, rewriter, QuerySpec, fixture, and ZTD behavior;
- CLI, scaffold, generated artifacts, docs, examples, and publish checks;
- Concept Specs, DFDs, Process Maps, package scope, authority, and technology policy;
- tests, required checks, external prerequisites, and base-branch comparison needs.

Use `issue-concept-grounding` before planning business-bearing or domain-meaning work. Route to package and specialist skills only when their trigger matches. In particular:

- use `core-parser-analyzer-change` for `packages/core` syntax, AST, formatter, analyzer, or derived metadata work;
- use `api-output-shape-review` for SQL-string versus AST/model output decisions;
- use `package-spec-review` and `structured-metadata-migration-review` for their declared specification surfaces;
- use `ztd-sql-unit-tests` or `ztd-ddl-sync-and-debug` for SQL rewriter, fixture, manifest, shadowing, or schema-drift work;
- use `changeset-classification` before authoring a Changeset.

Never route to a missing skill or a skill whose referenced package or command is absent from tracked `origin/main`.

## 3. Classify difficulty and risk

Classify both independently. A narrow edit can still be high risk.

| Level | Difficulty indicators | Default model and reasoning |
| --- | --- | --- |
| `low` | Mechanical, explicit completion shape, no behavior change, one narrow surface | `gpt-5.6-luna` / `medium` |
| `medium` | Bounded single-package change, normal tests, limited design choice | `gpt-5.6-terra` / `medium` or `high` |
| `high` | Multiple packages, public API, parser/rewriter/ZTD behavior, generated artifacts, or difficult CI diagnosis | `gpt-5.6-sol` / `high` or `xhigh` |
| `critical` | Architecture, migration, ambiguous objective, broad compatibility risk, or several independent investigation lanes | `gpt-5.6-sol` / `max`; use `ultra` only when useful work can be delegated in parallel |

Raise risk for breaking or semver-sensitive behavior, Concept or package authority changes, DDL/data migration, scaffold or publish contracts, unknown required-check failures, or environment-only verification.

Use the higher of difficulty and risk as the final routing tier. At minimum, raise reasoning depth and verification coverage by one tier when risk exceeds mechanical difficulty; public API, semver, data, or human-authority risk must never route as `low`.

Before dispatch, confirm that the destination host supports the selected model and reasoning effort. If no standing model policy or explicit model choice exists, report the recommendation and stop for approval. Do not silently substitute another model.

## 4. Decide the execution environment

- Keep read-only impact analysis in the orchestration task.
- For unrelated repository mutations, create a new project-scoped Codex worktree task and omit `startingState` so it starts from the project's default branch.
- Use an existing branch or working tree only when the user explicitly asks to continue that exact state.
- After worktree creation, create a `codex/<task-slug>` branch before committing.
- Do not replace a user-owned implementation task with an internal subagent. Internal subagents share the parent task and are evaluation or exploration helpers.
- If the canonical repository is not registered as a Codex project, stop dispatch and name that exact prerequisite. Do not target a different project or modify private App state.

## 5. Build the worker packet

Include:

- source request and objective;
- affected packages, contracts, and artifacts;
- applicable `AGENTS.md`, concepts, and skills;
- acceptance items and a verification method for each;
- explicit out-of-scope items;
- selected model, reasoning effort, and why;
- target project, `worktree`, default-branch base, and proposed `codex/<task-slug>` branch;
- required dogfooding or independent review;
- stop conditions and model-escalation conditions.

Require the worker to maintain `tmp/PLAN.md` for multi-step work and `tmp/RETRO.md` for meaningful recognition or verification misses.

## 6. Close the workflow

Use this order:

1. implementation;
2. verification against each acceptance item;
3. conditional dogfooding when evaluator separation adds value;
4. draft attainment report;
5. consistency and concept-boundary review, the pre-PR retro gate, then human-acceptance review;
6. for any blocker or material implementation/report change, return to implementation, affected verification, an updated draft report, and every affected review gate;
7. repeat until no blocker remains, and rerun the affected review cycle whenever post-review wording changes a material claim;
8. final attainment report;
9. PR readiness validation and human decision.

Do not declare completion or PR readiness while a required check or PR-blocking retro item remains unresolved.

## Output

- `Task Class`
- `Objective`
- `Current Phase`
- `Impact Surface`
- `Concept / Package Grounding`
- `Acceptance Readiness`
- `Difficulty`
- `Risk`
- `Recommended Model / Reasoning`
- `Why This Model`
- `Applicable Skills`
- `Thread Target / Base / Branch`
- `Verification Plan`
- `Worker Prompt`
- `Next Skill`
- `Human Stop Condition`
- `Escalation Condition`
