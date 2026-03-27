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

## Reporting Format
- Reports MUST use an itemized structure with `acceptance item`, `status`, `evidence`, and `gap`.
- Status values MUST be `done`, `partial`, or `not done`.
- If a task is incomplete, the gap MUST be explicit.

## Completion
- Repository implementation is only complete when the acceptance items and verification methods are explicit and the required checks have been run or justified as inapplicable.
