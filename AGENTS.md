# Repository Scope

This file defines repository-wide rules for rawsql-ts developers.
Deeper `AGENTS.md` files take precedence when they add stricter or narrower rules without weakening completion criteria.

## Global Guardrails

- Keep generated artifacts, fixtures, and derived docs aligned with their source assets.
- Keep scaffold code, scaffold-facing docs, and published-package smoke checks aligned when they describe the same workflow.
- Do not weaken completion criteria or skip required verification.
- Prefer `pnpm` and scoped commands when working in a package.
- Keep repository artifacts in English unless a deeper rule says otherwise.
- Keep assistant-user conversation in Japanese in this repository.
- Do not mix customer-facing guidance into this repository policy.

## Guidance Routing

- Use the repo-local guidance under `.codex/guidance/` and `.agents/skills/` for planning, verification, review, and reporting details; `.codex/agents/*.toml` exposes that guidance through Codex-native custom agents.
- Root `AGENTS.md` defines repository-wide policy only; detailed output formats and workflows belong to subagent or skill guidance.
- Before substantial multi-step work, read the relevant guidance under `.codex/guidance/` or `.agents/skills/` instead of relying on root policy alone.
- For new rawsql-ts issues, bugs, features, refactors, investigations, CI failures, migrations, or review requests that need impact and execution routing, use `.agents/skills/rawsql-task-orchestrator/SKILL.md` before acting on the task.
- For an independent parent/child Codex worktree task, use `.codex/guidance/parent-child-orchestration.md` with the routed task orchestrator; it connects handoff to existing gates and does not replace package-specific skills.
- For package-level Scope, Test Policy, Authority Model, Technology Policy, review-plan, or generated review view changes, use `.agents/skills/package-spec-review/SKILL.md`.
- For structured metadata migrations or rule registry changes, use `.agents/skills/structured-metadata-migration-review/SKILL.md` to check schema versioning, canonical enum parity, real fixture parsing, and evidence/display-label integrity.
- For broad generated or derived diffs that may exceed review-tool limits, use `.agents/skills/broad-generated-diff-review-packet/SKILL.md` to prepare scoped review packets before PR handoff.
- For `packages/core` parser, analyzer, formatter, AST, wildcard/select-output, or syntax-derived metadata changes, use `.agents/skills/core-parser-analyzer-change/SKILL.md` instead of re-deriving package-boundary and verification rules from memory.
- For public API or transformer changes that output SQL strings, AST/model objects, formatted SQL, or result objects containing `sql`, use `.agents/skills/api-output-shape-review/SKILL.md` to review model-vs-string output shape and formatter customization.
- For changeset additions, removals, stale-entry cleanup, or reviewer questions about patch/minor/major classification, use `.agents/skills/changeset-classification/SKILL.md`.
- For CodeRabbit or similar external AI review requests, rate-limit comments, stacked PRs, generated diffs, or review-tool quota concerns, use `.agents/skills/review-tool-volume-management/SKILL.md`.
- Do not turn `AGENTS.md` into the storage location for starter walkthroughs, AI onboarding prompts, dogfooding playbooks, or investigation scripts; keep those in dedicated docs or skills.

## Documentation Guardrails

- Treat README and other human-facing repository docs as reader-facing entry documentation, not AI-facing operational notes.
- Keep human-facing docs scannable: prefer short headings, short paragraphs, short sentences, and strong structure.
- Prefer separation over deletion: if content is too detailed for README, move it to linked docs instead of silently dropping important information.
- Keep repository facts, commands, contracts, and file layout accurate and easy to verify.
- Keep structured metadata sources, schema files, implementation allowlists, fixtures, and generated review views aligned when they describe the same review harness.
- Broad generated docs or API diffs should preserve source-to-generated traceability so reviewers can inspect the source decision separately from deterministic output.

### README Mode Rules

- Each substantial README section must have one primary mode:
  - tutorial
  - how-to
  - reference
  - explanation
- Do not mix modes within the same section unless the boundary is explicit.

### Mode Expectations

- tutorial
  - learning-oriented
  - optimize for first success
  - use small steps
  - minimize explanation
  - avoid alternatives unless essential for success
  - link out for deeper background

- how-to
  - goal-oriented
  - solve one concrete task or problem
  - include only the steps and decisions needed for that goal
  - avoid broad conceptual teaching

- reference
  - information-oriented
  - describe facts, commands, options, file layout, contracts, and limits
  - stay concise, structured, and neutral
  - do not add persuasion, narrative, or long explanation

- explanation
  - understanding-oriented
  - describe why, tradeoffs, design intent, constraints, and alternatives
  - do not turn explanation into a procedural guide

### README Defaults for This Repository

- README should lead with what the project is, why it exists, and how to start.
- Quickstart sections should stay short and copyable.
- Important concepts must remain available either in README or in clearly linked follow-up docs.
- Do not remove conceptual sections, follow-up reading, or navigation aids merely to shorten the README.
- When revising README, confirm that a new reader can understand the project and reach a successful first step from the first screen.

## Workflow Ownership

- Detailed planning, verification, reporting, review, PR-readiness, QuerySpec, and SQL-shadowing procedures are owned by the routed `.codex/guidance/` and `.agents/skills/` sources above. Read the applicable source before acting; do not duplicate those procedures in this root policy.
