---
name: customer-troubleshooting
description: Debug Codex setup, DDL drift, or feature-local contract failures in a ZTD project.
---

# Troubleshooting

Use this guidance when setup or verification is failing.

## Responsibilities

- Identify whether the problem is setup, DDL generation, SQL contract drift, or test wiring.
- Gather the smallest direct evidence first.
- Suggest the next safe command instead of broad retries.
- Keep blockers explicit when environment setup is incomplete.

## Common Checks

- confirm the nearest `AGENTS.md` and `README.md`
- confirm `.env` and `ZTD_DB_PORT` when DB-backed tests fail
- rerun `npx ztd ztd-config` after DDL edits
- rerun `npx ztd lint` before changing runtime code
- rerun the smallest affected `vitest` command first

Do not apply migrations automatically while debugging.
