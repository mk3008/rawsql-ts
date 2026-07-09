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
1. For a final report or PR, run the pre-PR retro gate and confirm no `open` retro item blocks readiness.
2. Run `consistency review`.
3. Run `concept boundary review` for changed package behavior, generated scaffold output, docs, and review wording. Read the owning package concept, package scope, technology policy, or Concept Spec when one exists, and check whether the change violates durable boundaries such as SQL-first visibility, human-owned concept authority, or package responsibility limits.
4. Record findings about literal drift, mirror / test / policy mismatch, concept / package-policy mismatch, required fields, GitHub-safe references, per-item final form, and test wording.
5. Run `human acceptance review`.
6. Record findings about reviewer cognitive load, issue context, visible value, visible evidence, guarantee limits, gaps, and next human decision.
7. Triage each finding as `blocker`, `follow-up`, or `nit`.
8. Resolve blockers, rerun affected verification, and repeat the affected review cycles; otherwise mark the result not ready.
9. If the final report or PR changes a material claim after review, rerun the affected review cycle before handoff.

## Output Shape
- Source request or source issue
- Review cycle 1 findings
- Concept boundary review findings
- Review cycle 2 findings
- Triage summary
- Review readiness
- What the human should decide next

## Constraints
- Run both review cycles before claiming readiness for human review.
- Do not claim readiness for package behavior, scaffold output, generated runtime code, docs, or PR text until the concept boundary review has checked the relevant Concept Spec or package concept when one exists.
- Treat a violation of a durable package concept as a blocker unless the PR explicitly includes a human-approved concept or scope change.
- Do not treat wording-only issues as blockers by default.
- Do not bury blockers inside a summary paragraph.
- If a blocker remains, mark the result not ready.
