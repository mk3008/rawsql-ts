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
- Reports must distinguish `done`, `partial`, and `not done`.
- Reports must distinguish `tests were updated` from `tests passed`.
- GitHub-facing reports must not use local filesystem paths.
- Supplementary evidence alone must not justify a strong `done` claim.

## Review Minimums

- Final PR text and final implementation reports must pass self-review before human review.
- Blockers must be resolved or explicitly called out before human review.

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
