---
name: developer-pre-pr-retro-gate
description: Check tmp/RETRO.md before PR or human review so unresolved retro items do not slip through rawsql-ts developer workflow.
---

# Pre-PR Retro Gate

Use this skill when rawsql-ts developer work is about to be reported as complete, handed to self-review, or presented in a PR and you need to confirm that unresolved retro items are not being ignored.

## Use It For
- Reviewing `tmp/RETRO.md` before PR handoff.
- Deciding whether retro items leave the task `done`, `partial`, or `not done`.
- Distinguishing `open`, `resolved`, and `accepted defer` gate states.
- Preparing the final report or PR text to surface any accepted defer decision explicitly.

## Workflow
1. Read `tmp/RETRO.md` if it exists.
2. List each retro item and its `PR gate status`.
3. Treat any `open` item as a blocker for PR readiness.
4. For `accepted defer`, confirm that the remaining risk, owner, and follow-up path are explicit.
5. If a defer rationale is missing, keep the gate blocked.
6. Feed the result into reporting and self-review.
7. Do not declare review readiness until the retro gate result is visible.

## Output Shape
- Retro items reviewed
- Gate result
- Blocking items
- Accepted defer items
- Required final-report callouts

## Constraints
- Do not skip the gate just because the code diff looks correct.
- Do not treat `accepted defer` as equivalent to `resolved`.
- If a retro item is hard to map to the report, keep the result not ready until the wording is fixed.
