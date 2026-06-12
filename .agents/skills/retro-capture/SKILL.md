---
name: developer-retro-capture
description: Capture meaningful recognition mismatches, false completion claims, and verification misses into tmp/RETRO.md for rawsql-ts developer work.
---

# Retro Capture

Use this skill when a rawsql-ts developer task hits a recognition mismatch, misleading completion claim, verification miss, or similar workflow mistake that should influence later reporting or PR readiness.

## Use It For
- Deciding whether an incident is important enough to record in `tmp/RETRO.md`.
- Turning a vague "something went wrong" moment into a reusable retro entry.
- Separating task-specific reflection from durable rule changes.
- Identifying whether the prevention should become guidance, a test, a script, or a Codex skill.
- Recording whether the item should block PR handoff.

## Workflow
1. Decide whether the incident materially affected rework, verification, or trust in a completion claim.
2. If yes, add or update an entry in `tmp/RETRO.md`.
3. State what happened and why it happened in concrete terms.
4. Record the impact on the task, report, or review path.
5. Decide whether the prevention is mechanizable.
6. If the prevention is reusable, name the likely promotion target such as `AGENTS.md`, `.codex/agents/*.md`, tests, scripts, or another Codex skill.
7. Set `PR gate status` to `open`, `resolved`, or `accepted defer`.
8. If the status is `accepted defer`, record the remaining risk, owner, and follow-up path.

## Output Shape
- Title
- What happened
- Why it happened
- Impact
- Mechanizable prevention
- Promote to durable rule?
- PR gate status
- Resolution / follow-up
- Defer rationale, when needed

## Constraints
- Use `tmp/RETRO.md` for task-specific reflection, not `AGENTS.md`.
- Do not create retro entries for trivial typos or harmless corrections.
- Do not mark an item `resolved` unless the reporting or workflow risk is actually closed.
- Prefer `open` over `accepted defer` when the tradeoff is not explicit.
