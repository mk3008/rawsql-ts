# Repository Scope

- Applies to the entire repository root.
- This repository guidance is for rawsql-ts developers only.
- Customer-facing guidance is out of scope here and belongs to Issue #685.
- Follow the nearest deeper `AGENTS.md` first when editing package-owned code.
- Use the repo-local Codex guidance under `.codex/agents/` and `.agents/skills/` for planning, verification, and reporting.

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

- Root `AGENTS.md` defines repository-wide guardrails, reporting discipline, and routing.
- Subagents under `.codex/agents/` provide task-oriented support for planning, verification, and reporting.
- Skills under `.agents/skills/` provide repeatable workflows for writing acceptance items, verification methods, and attainment summaries.
- Planning guidance is responsible for making `Source issue`, `Why it matters`, `Acceptance items`, and `Verification methods` explicit.
- Verification guidance is responsible for checking whether the planned verification methods were actually satisfied and for surfacing verification basis.
- Reporting guidance is responsible for reviewer-facing and operator-facing `Verification basis`, `Guarantee limits`, `Outstanding gaps`, and `What the human should decide next`.

## Routing

- Use `.codex/agents/planning.md` for plan shaping and acceptance-item decomposition.
- Use `.codex/agents/verification.md` for evidence gathering and verification planning.
- Use `.codex/agents/reporting.md` for attainment summaries and PR closeout.
- Use `.agents/skills/acceptance-planning/SKILL.md` when writing acceptance items or verification methods.
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
- Reports MUST use an itemized structure with:
  - `acceptance item`
  - `status`
  - `evidence`
  - `gap`
- Status values MUST be:
  - `done`
  - `partial`
  - `not done`
- Reports MUST NOT collapse multiple acceptance items into one vague summary.
- If a task is incomplete, the gap MUST be explicit.
- If a task is blocked by environment or tooling, the blocker MUST be stated in `evidence` or `gap`, and the item MUST be marked `partial` or `not done`.
- Reports MUST make it clear that PR text and normal Codex work reports are decision documents, not work logs.

## Final Attainment Reporting

- Final PRs and implementation reports MUST show per-item attainment for the acceptance items defined at plan time.
- Final attainment reporting MUST identify which items are `done`, `partial`, or `not done`.
- If an item is not fully complete, the remaining gap and the reason MUST be stated explicitly.
- Required dogfooding or real-task validation MUST be reported explicitly as satisfied, partial, or not done.

## Completion

- A change is only complete when:
  - its acceptance items are explicit,
  - its verification methods are explicit,
  - required checks have been run or justified as inapplicable,
  - and final reporting states per-item attainment.
  
