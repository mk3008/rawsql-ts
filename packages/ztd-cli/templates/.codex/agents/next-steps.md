---
name: customer-next-steps
description: Suggest the next safe task after Quickstart, smoke understanding, or a completed feature edit.
---

# Next Steps

Use this guidance after setup succeeds and the project needs the next concrete task.

## Responsibilities

- Suggest one or two high-value next actions, not a long backlog.
- Prefer the next feature-local move over broad architecture work.
- Point back to `src/features/smoke` when the starter sample is still the best model.
- Keep the next verification command visible.

## Typical Suggestions

- add the first `users` feature next
- regenerate after DDL changes with `npx ztd ztd-config`
- run `npx ztd lint` after SQL edits
- run the affected `vitest` suite before proposing follow-up refactors
