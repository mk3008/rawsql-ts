# Repository Scope

This file defines repository-wide rules for rawsql-ts developers.
Deeper `AGENTS.md` files take precedence when they add stricter or narrower rules without weakening completion criteria.

## Global Guardrails

- Keep generated artifacts, fixtures, and derived docs aligned with their source assets.
- Do not weaken completion criteria or skip required verification.
- Prefer `pnpm` and scoped commands when working in a package.
- Keep repository artifacts in English unless a deeper rule says otherwise.
- Keep assistant-user conversation in Japanese in this repository.
- Do not mix customer-facing guidance into this repository policy.

## Guidance Routing

- Use the repo-local guidance under `.codex/agents/` and `.agents/skills/` for planning, verification, review, and reporting details.
- Root `AGENTS.md` defines repository-wide policy only; detailed output formats and workflows belong to subagent or skill guidance.
- Before substantial multi-step work, read the relevant guidance under `.codex/agents/` or `.agents/skills/` instead of relying on root policy alone.

## Documentation Guardrails

- Treat README and other human-facing repository docs as reader-facing entry documentation, not AI-facing operational notes.
- Keep human-facing docs scannable: prefer short headings, short paragraphs, short sentences, and strong structure.
- Prefer separation over deletion: if content is too detailed for README, move it to linked docs instead of silently dropping important information.
- Keep repository facts, commands, contracts, and file layout accurate and easy to verify.

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

## Plan and Reporting Minimums

- Plans must state the source issue or request, acceptance items, verification methods, and explicit out-of-scope items when scope is limited.
- Multi-step tasks must keep a working ledger in `tmp/PLAN.md` unless a deeper `AGENTS.md` says otherwise.
- `tmp/PLAN.md` should be updated when the plan changes, when a blocker is discovered, and when a verification or dogfooding result materially changes the current understanding.
- `tmp/PLAN.md` is local task state, must not be committed, and exists separately from durable workflow rules in `AGENTS.md`.
- Important recognition mismatches, false completion claims, or verification misses must also be captured in `tmp/RETRO.md` when they could plausibly recur within the same task or in a future task.
- `tmp/RETRO.md` is a local-only reflection ledger for what went wrong, why it happened, whether the fix can be mechanized, whether a durable rule should be promoted, and whether a PR should be blocked until the item is resolved.
- Keep durable workflow policy in `AGENTS.md`; keep task-specific reflection, examples, and unresolved retro items in `tmp/RETRO.md`.
- If a retro item suggests a reusable mechanical guardrail, consider promoting it into repository guidance, tests, scripts, or a Codex skill instead of leaving it only as narrative reflection.
- Record a retro item when the miss caused rework, weakened a completion claim, hid a verification gap, or would be hard to reconstruct reliably from the final diff alone.
- Do not require retro entries for every small typo or harmless local correction; use it for mistakes that matter to task judgment, workflow safety, or future repeatability.
- Reports must distinguish `done`, `partial`, and `not done`.
- Reports must distinguish `tests were updated` from `tests passed`.
- If any test or check fails, reports must name the failing test or check explicitly instead of summarizing it only as a generic verification failure.
- If any test or check fails, reports must state whether the failure is newly introduced by the current change or reproducible on the base branch without the change.
- If any test or check fails, reports must state the failure's decision weight explicitly: required merge gate, non-required PR check, local-only check, or another clearly named category.
- If work proceeds despite a failing test or check, reports must explain why proceeding is acceptable for this change, based on the failure's category and whether it is pre-existing.
- If a task changes GitHub branch protection or rulesets, reports must explicitly state which merge blockers were changed or verified, not just the intended required status checks.
- Ruleset or branch protection reports must explicitly call out approval requirements, Code Owner review requirements, signed-commit requirements, and required status checks whenever those settings could affect mergeability.
- Do not imply that bot review comments or `COMMENTED` review states satisfy an approval requirement; approval claims must name the actor and the approval-capable review state.
- GitHub-facing reports must not use local filesystem paths.
- Supplementary evidence alone must not justify a strong `done` claim.
- Final user-facing progress and completion reports should use explicit sections rather than long narrative-only blocks when multiple concerns are being reported.
- When reporting task status, show the current status label near the top and again at the end when the report is long enough that scrolling could hide it.
- When reporting multiple concerns, separate at least `status`, `current situation`, and `remaining issues or decisions` so the reader can scan quickly.

## Review Minimums

- Final PR text and final implementation reports must pass self-review before human review.
- Blockers must be resolved or explicitly called out before human review.
- Before creating or presenting a PR, review `tmp/RETRO.md` and either resolve every PR-blocking retro item or explicitly surface the remaining item and why it is safe to defer.
- A retro item with `PR gate status: open` blocks PR readiness.
- `accepted defer` may be used only when the remaining risk, owner, and follow-up path are explicit in the final report or PR text.

## QuerySpec Completion

- A QuerySpec used for product behavior is incomplete unless it has a ZTD-backed test that executes the SQL through the rewriter.
- A property-only validation test is not sufficient for product behavior.
- If the ZTD-backed test cannot be written yet, do not write the product-behavior QuerySpec yet.
- Example-only QuerySpec files may omit the ZTD-backed test only when explicitly labeled as examples and the limitation is stated in the same change.

## Test Default

- Unless the request explicitly says not to, behavior changes must add or update tests in the same change.
- When ambiguous, prefer the strongest executable test for the changed behavior.
- For QuerySpec work, default to a ZTD-backed test that executes the SQL through the rewriter and validates observed behavior.

## SQL Shadowing Troubleshooting

- When a SQL-backed test fails, first determine whether the query is shadowing the intended SQL path or touching a physical table directly.
- If shadowing is wrong, check in this order:
  1. DDL and fixture sync
  2. Fixture selection or specification
  3. Repository bug or rewriter bug
- Do not use DDL execution as a repair path for ZTD validation failures.
- Prefer repository evidence over manual database repair.
