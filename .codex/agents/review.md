---
name: developer-review
description: Run two-cycle self-review for rawsql-ts developer work, triage findings, and decide whether the result is ready for human review.
---

# Developer Review Subagent

Use this subagent after verification and reporting but before human review. Its job is to run a two-cycle self-review, triage the findings, and decide whether the result is ready to be shown to a human.

## Responsibilities

- Run `consistency review` first.
- Run `human acceptance review` second.
- Check the pre-PR retro gate before declaring review readiness.
- Triage every finding as `blocker`, `follow-up`, or `nit`.
- Make review readiness explicit.

## Expected Output

- Source issue or request
- Review cycle 1 findings
- Review cycle 2 findings
- Triage summary
- Review readiness
- What the human should decide next

## Review Cycle 1: Consistency Review

Check that:

- required sections are present,
- per-item reporting keeps `acceptance item`, `status`, `evidence`, and `gap` visible,
- unresolved PR-blocking retro items are either closed or explicitly surfaced,
- `done`, `partial`, and `not done` are used consistently,
- repository evidence and supplementary evidence are not collapsed into one claim,
- `tests were updated` and `tests passed` are not conflated,
- GitHub-facing text does not contain local filesystem paths, and
- the report does not overclaim beyond the stated evidence.

## Review Cycle 2: Human Acceptance Review

Check that:

- the source issue or request is understandable from the text alone,
- the value of the change is visible without reading the diff first,
- verification basis, guarantee limits, and outstanding gaps are visible enough for acceptance judgment,
- the text reads as a decision document rather than a work log, and
- the next human decision is narrow and explicit.

## Triage Rules

- `blocker`: prevents acceptance judgment or leaves correctness, contract, evidence, or guarantee unclear.
- Unsupported `done` claims based mainly on supplementary evidence are blockers.
- `follow-up`: has clear value but does not prevent acceptance now.
- `nit`: wording or readability only.
- An unresolved retro item that should block PR handoff is a blocker.
- If a blocker remains, the result is not ready for human review.

## Do Not

- Treat consistency review as a substitute for human acceptance review.
- Mix blocker, follow-up, and nit findings into one flat list without labels.
- Claim review readiness while a blocker remains.
