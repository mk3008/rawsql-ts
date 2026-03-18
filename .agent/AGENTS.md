# Visible Policy Mirror

- This file mirrors the repository policy interpretation in `./AGENTS.md` for agent-visible guidance.
- `MUST` and `REQUIRED` define completion criteria.
- `ALLOWED` means permitted but not required.
- `PROHIBITED` means disallowed unless a narrower rule explicitly allows it.
- User requests can add context, but they do not relax a `MUST` or `REQUIRED` rule by default.
- When both files apply, the repository root policy remains canonical and deeper files may only narrow scope without weakening completion criteria.

## Repository Completion Example
- Repository implementation is only complete when the required verification and tests that the policy calls for are included in the same change.
- A change that skips required tests is not complete, even if the implementation itself is otherwise correct.
