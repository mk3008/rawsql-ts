---
"@rawsql-ts/ztd-cli": minor
---

Remove customer-facing AI control file distribution from `ztd-cli`.

This removes the `ztd agents` command group, removes the `ztd init` AI guidance flags, and stops starter/init scaffolds from distributing `AGENTS.md`, `.codex/**`, `CONTEXT.md`, `PROMPT_DOGFOOD.md`, or `.ztd/agents/**` artifacts.
