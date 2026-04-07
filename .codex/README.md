# Repo-local Codex guidance

This directory holds repo-local workflow guidance for rawsql-ts.

## What lives here

- `.codex/agents/` contains role-oriented guidance for planning, verification, review, and reporting.
- `.codex/config.toml` records the routing for those workflow guides.

## What does not live here

- Stable user-level defaults belong in `~/.codex/AGENTS.md`.
- Reusable repo workflows belong in `.agents/skills/`.
- Repository-wide policy should stay short and should not be duplicated across every workflow guide unless it affects that workflow directly.

## Current design choice

The previous root `AGENTS.md` mixed repo-wide policy, routing, and output templates.
This `.codex` folder now keeps only workflow guidance.
Rules that directly affect planning or verification in rawsql-ts, such as QuerySpec plus ZTD-backed test expectations, are embedded only in the guides that need them.
