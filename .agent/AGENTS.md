# Visible Policy Mirror
- This file mirrors the repository root guidance in `../AGENTS.md`.
- `MUST` and `REQUIRED` define completion criteria.
- `ALLOWED` means permitted but not required.
- `PROHIBITED` means disallowed unless a narrower rule explicitly allows it.
- User requests can add context, but they do not relax a `MUST` or `REQUIRED` rule by default.
- When both files apply, the repository root policy remains canonical and deeper files may only narrow scope without weakening completion criteria.

## Global Guardrails
- Keep generated artifacts, fixtures, and derived docs aligned with their source assets.
- Do not weaken completion criteria or skip required verification.
- Keep documentation and comments in English.
- All assistant-user conversation in this repository must be in Japanese.
- Do not mix customer-oriented guidance into this repository policy.

## Routing
- Use `.codex/agents/planning.md`, `.codex/agents/verification.md`, `.codex/agents/review.md`, and `.codex/agents/reporting.md` for developer workflow support.
- Use `.agents/skills/acceptance-planning/SKILL.md`, `.agents/skills/self-review/SKILL.md`, and `.agents/skills/attainment-reporting/SKILL.md` for repeatable planning, review, and reporting workflows.

## Responsibility Split
- Planning guidance makes `Source issue`, `Why it matters`, `Acceptance items`, and `Verification methods` explicit.
- Verification guidance checks whether the planned verification methods were actually satisfied and surfaces verification basis.
- Review guidance runs two-cycle self-review and triages findings before human review.
- Reporting guidance makes `Verification basis`, `Guarantee limits`, `Outstanding gaps`, and `What the human should decide next` visible to reviewers and requesters.

## Plan-Time Requirements
- Plans MUST state the `Source issue` and `Why it matters`.
- Acceptance items MUST be explicit.
- Verification methods MUST be explicit for each acceptance item.
- Downstream `Decision points` SHOULD be explicit when the result will require a human choice.

## Reporting Format
- Reports MUST state the `Source request` or `Source issue` and `Why it matters` before item-level status.
- Reports MUST state `What changed` before file inventory or file lists.
- Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.
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
- Status values MUST be `done`, `partial`, or `not done`.
- If a task is incomplete, the gap MUST be explicit.
- Reports MUST make `Verification basis`, `Guarantee limits`, and `Outstanding gaps` visible when needed.
- Reports MUST end with `What the human should decide next`.
- `What changed` MUST describe user-facing or reviewer-facing meaning before implementation detail or file names.
- `Verification basis` MUST state what observation was treated as sufficient to call the shape or item satisfied.
- `What the human should decide next` SHOULD be phrased as a narrow choice whenever possible.
- Reports MUST make clear that PR text and normal Codex work reports are decision documents, not work logs.

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

## Completion
- Repository implementation is only complete when the acceptance items and verification methods are explicit and the required checks have been run or justified as inapplicable.

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
