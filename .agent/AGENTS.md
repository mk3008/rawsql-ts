# Visible Policy Mirror
- This file mirrors the repository root guidance in `./AGENTS.md`.
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
- Use `.codex/agents/planning.md`, `.codex/agents/verification.md`, and `.codex/agents/reporting.md` for developer workflow support.
- Use `.agents/skills/acceptance-planning/SKILL.md` and `.agents/skills/attainment-reporting/SKILL.md` for repeatable planning and reporting workflows.

## Responsibility Split
- Planning guidance makes `Source issue`, `Why it matters`, `Acceptance items`, and `Verification methods` explicit.
- Verification guidance checks whether the planned verification methods were actually satisfied and surfaces verification basis.
- Reporting guidance makes `Verification basis`, `Guarantee limits`, `Outstanding gaps`, and `What the human should decide next` visible to reviewers and requesters.

## Plan-Time Requirements
- Plans MUST state the `Source issue` and `Why it matters`.
- Plans MUST make acceptance items explicit.
- Plans MUST make verification methods explicit for each acceptance item.
- Plans SHOULD make downstream `Decision points` explicit when the result will require a human choice.

## Reporting Format
- Reports MUST state the `Source request` or `Source issue` and `Why it matters` before item-level status.
- Reports MUST state `What changed` before file inventory or file lists.
- Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.
- Status values MUST be `done`, `partial`, or `not done`.
- If a task is incomplete, the gap MUST be explicit.
- Reports MUST make `Verification basis`, `Guarantee limits`, and `Outstanding gaps` visible when needed.
- Reports MUST end with `What the human should decide next`.
- Reports MUST make clear that PR text and normal Codex work reports are decision documents, not work logs.

## Completion
- Repository implementation is only complete when the acceptance items and verification methods are explicit and the required checks have been run or justified as inapplicable.
