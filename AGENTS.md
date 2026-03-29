# Repository Scope

- Applies to the entire repository root.
- This repository guidance is for rawsql-ts developers only.
- Customer-facing guidance is out of scope here and belongs to Issue #685.
- Follow the nearest deeper `AGENTS.md` first when editing package-owned code.
- Use the repo-local Codex guidance under `.codex/agents/` and `.agents/skills/` for planning, verification, review, and reporting.

## Interpretation

- `MUST` and `REQUIRED` define completion criteria.
- `ALLOWED` means permitted but not required.
- `PROHIBITED` means disallowed unless a narrower rule explicitly allows it.
- User requests can add task-specific context, but they do not relax a `MUST` or `REQUIRED` rule by default.
- When this file and a deeper `AGENTS.md` both apply, the deeper file may narrow scope only if it does not weaken a completion criterion.

## Global Guardrails

- Keep generated artifacts, fixtures, and derived docs aligned with their source assets.
- Do not weaken completion criteria or skip required verification.
- Prefer `pnpm` and scoped commands when working in a package.
- Keep documentation and comments in English.
- All assistant-user conversation in this repository must be in Japanese.
- Do not mix customer-oriented guidance into this repository policy.

## Guidance Roles

- Root `AGENTS.md` defines repository-wide guardrails, review discipline, and routing.
- Subagents under `.codex/agents/` provide task-oriented support for planning, verification, review, and reporting.
- Skills under `.agents/skills/` provide repeatable workflows for writing acceptance items, verification methods, self-review findings, and attainment summaries.
- Planning guidance is responsible for making `Source issue`, `Why it matters`, `Acceptance items`, and `Verification methods` explicit.
- Verification guidance is responsible for checking whether the planned verification methods were actually satisfied and for surfacing verification basis.
- Review guidance is responsible for two-cycle self-review and triage before human review.
- Reporting guidance is responsible for reviewer-facing and operator-facing `Verification basis`, `Guarantee limits`, `Outstanding gaps`, and `What the human should decide next`.

## Routing

- Use `.codex/agents/planning.md` for plan shaping and acceptance-item decomposition.
- Use `.codex/agents/verification.md` for evidence gathering and verification planning.
- Use `.codex/agents/review.md` for self-review, two-cycle review, and triage before human review.
- Use `.codex/agents/reporting.md` for attainment summaries and PR closeout.
- Use `.agents/skills/acceptance-planning/SKILL.md` when writing acceptance items or verification methods.
- Use `.agents/skills/self-review/SKILL.md` when reviewing consistency, human acceptance readability, or triaging findings.
- Use `.agents/skills/attainment-reporting/SKILL.md` when writing per-item attainment reporting.

## Plan-Time Requirements

- Plans MUST state the `Source issue` and `Why it matters`.
- Plans MUST make acceptance items explicit.
- Plans SHOULD make downstream `Decision points` explicit when the result will require a human choice.
- Plans MUST make verification methods explicit for each acceptance item.
- Plans MUST define completion in terms of attainment, not only file creation or code modification.
- If scope is limited, out-of-scope items MUST be stated explicitly.

## Reporting Requirements

- Reports MUST state the `Source request` or `Source issue` and `Why it matters` before item-level status.
- Reports MUST state `What changed` before file inventory or file lists.
- Reports MUST state the `Verification basis` and `Guarantee limits` when evidence does not fully close an item.
- Reports MUST state `Outstanding gaps` explicitly.
- Reports MUST end with `What the human should decide next`.
- `What changed` MUST describe user-facing or reviewer-facing meaning before implementation detail or file names.
- `Verification basis` MUST state what observation was treated as sufficient to call the shape or item satisfied.
- `What the human should decide next` SHOULD be phrased as a narrow choice whenever possible.
- Reports MUST use an itemized structure with:
  - `acceptance item`
  - `status`
  - `evidence`
  - `gap`
- Final PR text and final implementation reports MUST keep those fields visible per acceptance item.
- Global summary sections MUST NOT replace per-item status, evidence, or gap.
- GitHub-facing reports MUST NOT use local filesystem links such as `/C:/...`; use repo-relative references or plain text.
- If a GitHub-facing report contains a local filesystem path, final form is incomplete.
- Reports MUST distinguish `tests were updated` from `tests passed`.
- If execution is blocked or not run, the affected item MUST remain `partial` or `not done`.
- Reports MUST distinguish `Repository evidence` from `Supplementary evidence` when both appear.
- `Repository evidence` means reviewer-checkable evidence that remains in the repo or CI-visible record, such as code, tests, snapshots, checked-in docs, and CI-visible outputs.
- `Supplementary evidence` means local logs, external observations, manual checks that are not committed, and non-reproducible or environment-specific notes.
- PR reports MUST treat `Repository evidence` as the primary basis for acceptance judgment.
- PR reports MUST treat `Supplementary evidence` as supporting material, not as the same class of evidence as `Repository evidence`.
- `Supplementary evidence` alone MUST NOT justify a strong `done` claim unless the guarantee limits explicitly narrow the claim and the reviewer can still judge the accepted scope.
- If an item relies mainly on `Supplementary evidence`, the report MUST keep the item `partial` or make the guarantee limits explicit enough to narrow the claim.
- Normal Codex work reports MAY include more supplementary operational detail than PR reports, but they MUST still label it as supplementary when it is not reviewer-checkable.
- Status values MUST be:
  - `done`
  - `partial`
  - `not done`
- Reports MUST NOT collapse multiple acceptance items into one vague summary.
- If a task is incomplete, the gap MUST be explicit.
- If a task is blocked by environment or tooling, the blocker MUST be stated in `evidence` or `gap`, and the item MUST be marked `partial` or `not done`.
- Reports MUST make it clear that PR text and normal Codex work reports are decision documents, not work logs.

## Review Requirements

- Final PR text and final implementation reports MUST pass two-cycle self-review before human review.
- Review cycle 1 is `consistency review`.
- Consistency review MUST check literal drift, mirror / test / policy mismatch, required field coverage, GitHub-safe references, per-item final form, and `tests were updated` versus `tests passed` wording.
- Review cycle 2 is `human acceptance review`.
- Human acceptance review MUST check whether a reviewer can judge the result from the text alone without reconstructing the issue, value, evidence, guarantee limits, or gaps from memory.
- Review findings MUST be triaged as `blocker`, `follow-up`, or `nit`.
- A `blocker` prevents acceptance judgment or leaves correctness, contract, evidence, or guarantee unclear.
- A `follow-up` has clear value but does not prevent this change from being accepted now.
- A `nit` is wording or readability only and MUST NOT be treated as a blocker by default.
- Blockers MUST be resolved or explicitly called out as the reason the change is not ready for human review.
- Follow-up and nit findings MAY remain only if they are explicitly triaged and do not hide a blocker.

## Final Attainment Reporting

- Final PRs and implementation reports MUST show per-item attainment for the acceptance items defined at plan time.
- Final attainment reporting MUST identify which items are `done`, `partial`, or `not done`.
- If an item is not fully complete, the remaining gap and the reason MUST be stated explicitly.
- Required dogfooding or real-task validation MUST be reported explicitly as satisfied, partial, or not done.

## Completion

- A change is only complete when:
  - its acceptance items are explicit,
  - its verification methods are explicit,
  - its two self-review cycles and triage are explicit,
  - required checks have been run or justified as inapplicable,
  - final reporting states per-item attainment,
  - and the change is ready for human review or explicitly marked not ready.

## QuerySpec Completion
- A QuerySpec used for product behavior is incomplete unless it has a ZTD-backed test that executes the SQL through the rewriter.
- Writing a product-behavior QuerySpec is equivalent to asserting that the behavior will be verified in ZTD format.
- A property-only validation test is not sufficient for product behavior and MUST NOT be treated as the required QuerySpec verification.
- If the ZTD-backed test cannot be written yet, do not write the product-behavior QuerySpec yet.
- Example-only QuerySpec files MAY omit the ZTD-backed test only when the file is explicitly labeled as an example and the limitation is stated in the same change.

## Test Default
- Unless the request explicitly says not to, behavior changes MUST add or update tests in the same change.
- When the request is ambiguous, prefer the strongest executable test that exercises the behavior instead of a property-only check.
- For QuerySpec work, default to a ZTD-backed test that executes the SQL through the rewriter and validates observed behavior.
- When a QuerySpec is requested for product behavior, treat the QuerySpec and its ZTD-backed test as one completion unit.

## SQL Shadowing Troubleshooting
- When a SQL-backed test fails, first determine whether the query is shadowing the intended SQL path or accidentally touching a physical table directly.
- If the SQL is not shadowing correctly, check the failure in this order:
  1. DDL and fixture sync
  2. Fixture selection or specification
  3. repository bug or rewriter bug
- Do not use DDL execution as a repair path for ZTD validation failures.
- If the database is reachable, treat relation or missing-table errors as a shadowing, fixture, or repository problem before considering schema changes.
- SQL shadowing diagnostics MUST prefer repository evidence over manual database repair.
  
