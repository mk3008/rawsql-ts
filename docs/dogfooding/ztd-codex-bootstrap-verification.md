# Codex Bootstrap Verification

This document records a reviewer-checkable verification pass for the customer-facing `ztd agents init` bootstrap.

## What Was Installed

- visible `AGENTS.md` guidance
- `.codex/config.toml`
- `.codex/agents/planning.md`
- `.codex/agents/troubleshooting.md`
- `.codex/agents/next-steps.md`
- `.agents/skills/quickstart/SKILL.md`
- `.agents/skills/troubleshooting/SKILL.md`
- `.agents/skills/next-steps/SKILL.md`

## Fresh Project Verification

1. Create a fresh project with `ztd init --starter`.
2. Run `ztd agents init --dry-run` and confirm the planned managed set.
3. Run `ztd agents init`.
4. Confirm that the generated files exist and that existing user-owned files are preserved.
5. Ask Codex to inspect `src/features/smoke` and plan the next `users` feature.

## How To Verify

- Check the CLI output for the planned managed set.
- Check that `ztd init` alone does not create `.codex/` or `.agents/`.
- Check that `ztd agents status` distinguishes `managed`, `missing`, `customized`, and `unmanaged-conflict`.
- Check that the bootstrap guidance points the first request toward `src/features/smoke` and the next `users` feature.

## What Becomes Possible

- A customer project can opt into a minimal Codex bootstrap without changing the default scaffold.
- The first Codex request after Quickstart has a concrete starting point.
- Troubleshooting and next-step guidance are available without importing the rawsql-ts developer-only repo policy.

## Guarantee Limits

- This verification covers the managed bootstrap set and fresh-project installation flow.
- It does not claim plugin distribution, remote registry delivery, or automatic migration execution support.

## Weak Spots Or Out Of Scope Areas

- Existing user-owned guidance files are preserved, so manual reconciliation can still be required.
- The bootstrap is intentionally minimal and does not try to encode every possible project policy.
- Internal `.ztd/agents/` guidance from `ztd init --with-ai-guidance` remains a separate opt-in path.
