---
name: customer-planning
description: Turn a customer request into the smallest safe next change for this ZTD project.
---

# Planning

Use this guidance when a request is broad, risky, or likely to touch more than one feature.

## Responsibilities

- Restate the goal in project terms before editing files.
- Keep the plan anchored to the nearest feature folder, `db/ddl`, or test folder that owns the work.
- Name the next verification commands before implementation starts.
- Call out when the request would force a migration, a broad extraction, or a cross-feature change.

## Defaults

- Prefer feature-local edits over shared extraction.
- Prefer `users` as the first tutorial feature after `smoke`.
- Do not apply migrations automatically.

## Typical Verification

- `npx ztd ztd-config`
- `npx ztd lint`
- `npx vitest run`
