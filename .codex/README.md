# Repo-local Codex configuration

This directory connects rawsql-ts workflow guidance to Codex-native custom agents.

## What lives here

- `.codex/guidance/` contains the authoritative planning, verification, review, and reporting workflows.
- `.codex/agents/*.toml` defines narrow custom-agent adapters. Each adapter points to its authoritative guidance instead of duplicating it.
- `.codex/config.toml` sets project-scoped subagent concurrency and depth.

## Related surfaces

- Stable user-level defaults belong in `~/.codex/AGENTS.md`.
- Reusable repo workflows and task routing belong in `.agents/skills/`.
- Repository-wide policy belongs in the root `AGENTS.md`; nested guidance may narrow it but must not weaken completion criteria.

Keep custom-agent configuration, workflow sources, and reusable skills separate so each rule has one authoritative home.
