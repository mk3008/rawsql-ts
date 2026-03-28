---
name: customer-quickstart
description: Help a customer project start using the generated ZTD scaffold and Codex bootstrap safely.
---

# Quickstart

Use this skill when the project was freshly created or the next task is unclear.

## Use It For

- Explaining when to run `ztd init --starter` versus `ztd init`
- Explaining what `ztd agents init` generated
- Pointing to `src/features/smoke` as the starter sample
- Framing the first useful Codex request after setup

## Default Flow

1. Read `README.md` and the nearest `AGENTS.md`.
2. Inspect `src/features/smoke` if it exists.
3. Choose the next feature-local task, usually `users`.
4. Keep SQL, specs, and tests inside the owning feature.
5. Verify with `npx vitest run` and the smallest relevant `ztd` command.
