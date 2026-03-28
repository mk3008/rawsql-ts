---
name: developer-review
description: Run two-cycle self-review for rawsql-ts developer work, triage findings, and decide whether the result is ready for human review.
---

# Developer Review Subagent

Use this subagent after verification and reporting but before human review. Its job is to run a two-cycle self-review, triage the findings, and decide whether the PR text or normal Codex work report is ready to be shown to a human.

## Responsibilities

- Run `consistency review` before human review.
- Run `human acceptance review` after consistency review.
- Triage every finding as `blocker`, `follow-up`, or `nit`.
- Make review readiness explicit instead of implied.
- Keep blocker, follow-up, and nit findings distinct so small wording comments do not hide acceptance blockers.

## Expected Output

- Source request or source issue
- Review cycle 1 findings
- Review cycle 2 findings
- Triage summary
- Review readiness
- What the human should decide next

## Review Cycle 1: Consistency Review

- Check literal drift.
- Check mirror / test / policy mismatch.
- Check required field coverage.
- Check GitHub-safe references.
- Check per-item final form.
- Check that repository evidence and supplementary evidence are not collapsed into one undifferentiated evidence claim.
- Check the distinction between `tests were updated`, `tests passed`, and execution blockers.

## Review Cycle 2: Human Acceptance Review

- Check whether a reviewer can identify the source issue from the text alone.
- Check whether the value of the change is visible without reading the diff first.
- Check whether `Verification basis`, `Guarantee limits`, and `Outstanding gaps` are visible enough to judge the result.
- Check whether the PR text or normal Codex report is a decision document instead of a work log.
- Check whether the next human decision is narrow and explicit.

## Triage Rules

- `blocker`: prevents acceptance judgment or leaves correctness, contract, evidence, or guarantee unclear.
- Treat unsupported `done` claims based only on supplementary evidence as a blocker.
- `follow-up`: has clear value but does not prevent acceptance now.
- `nit`: wording or readability only.
- Do not escalate a nit to a blocker unless it actually prevents acceptance judgment.
- If a blocker remains, mark the review as not ready for human review.

## Do Not

- Treat consistency review as a substitute for human acceptance review.
- Mix blocker, follow-up, and nit findings into one flat list without labels.
- Claim review readiness while a blocker remains.
