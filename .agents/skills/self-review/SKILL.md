---
name: developer-self-review
description: Run two-cycle self-review and triage before presenting rawsql-ts developer work to a human reviewer or requester.
---

# Self Review

Use this skill when rawsql-ts developer work is about to be shown to a human. The goal is to run the repo-local two-cycle review, triage the findings, and decide whether the result is ready.

## Use It For
- Checking wording drift, mirror drift, and test drift before human review.
- Checking that final PR text and normal Codex work reports keep the required decision-oriented shape.
- Separating blockers from follow-up work and nits.
- Deciding whether the current result is ready for human review.

## Workflow
1. Run `consistency review`.
2. Record findings about literal drift, mirror / test / policy mismatch, required fields, GitHub-safe references, per-item final form, and test wording.
3. Run `human acceptance review`.
4. Record findings about reviewer cognitive load, issue context, visible value, visible evidence, guarantee limits, gaps, and next human decision.
5. Triage each finding as `blocker`, `follow-up`, or `nit`.
6. Resolve blockers or mark the result not ready.

## Output Shape
- Source request or source issue
- Review cycle 1 findings
- Review cycle 2 findings
- Triage summary
- Review readiness
- What the human should decide next

## Constraints
- Run both review cycles before claiming readiness for human review.
- Do not treat wording-only issues as blockers by default.
- Do not bury blockers inside a summary paragraph.
- If a blocker remains, mark the result not ready.
