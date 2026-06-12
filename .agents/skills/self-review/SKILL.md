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
2. Run `concept boundary review` for changed package behavior, generated scaffold output, docs, and review wording. Read the owning package concept, package scope, technology policy, or Concept Spec when one exists, and check whether the change violates durable boundaries such as runtime-free standard paths, SQL-first visibility, human-owned concept authority, or package responsibility limits.
3. Record findings about literal drift, mirror / test / policy mismatch, concept / package-policy mismatch, required fields, GitHub-safe references, per-item final form, and test wording.
4. Run `human acceptance review`.
5. Record findings about reviewer cognitive load, issue context, visible value, visible evidence, guarantee limits, gaps, and next human decision.
6. Triage each finding as `blocker`, `follow-up`, or `nit`.
7. Resolve blockers or mark the result not ready.

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
