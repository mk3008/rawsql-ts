---
name: developer-attainment-reporting
description: Report per-item attainment for completed rawsql-ts developer work.
---

# Attainment Reporting

Use this skill when a rawsql-ts developer task is ready to be summarized in a PR or normal Codex work report that a human can use as a decision document, not as a work log.

## Use It For
- Mapping each acceptance item to `done`, `partial`, or `not done`.
- Capturing evidence for each status.
- Making the source request or source issue, why it matters, and the guarantee limits visible in the report.
- Making the actual change and the next human decision visible without forcing the reader to reconstruct context.
- Explaining what was better than manual work and what remained insufficient.
- Writing PR text and normal Codex reports as acceptance or operator decision documents, not work logs.

## Workflow
1. State the source request or source issue and why it matters.
2. Summarize what changed in terms of user-visible or reviewer-visible meaning before any file-level detail.
3. List the acceptance items or decision points from the plan.
4. Map each item to a status.
5. Add the verification basis and evidence that justify the status, including what counted as shape satisfaction.
6. State the guarantee limits for each item when needed.
7. Call out what was still insufficient and whether follow-up is needed.
8. End with what the human should decide next in a narrow choice whenever possible.

## Output Shape
- Source request or source issue
- Why it matters
- What changed
- Acceptance items
- Decision points
- Verification basis
- Guarantee limits
- Outstanding gaps
- Acceptance items status
- Outcome
- Attainment level
- What the human should decide next
- Follow-up

## Constraints
- Keep the report explicit and itemized.
- Do not hide partial completion behind a summary sentence.
- Do not force the reviewer or requester to reconstruct the request, acceptance criteria, or operator decision from context.
- Put value, verification, limits, and next human decision ahead of file lists.
- In `What changed`, describe the meaning of the change before naming files or implementation details.
- In `Verification basis`, state what observation was treated as sufficient to call the reporting shape satisfied.
- In `What the human should decide next`, prefer a narrow accept-or-defer style choice over an open-ended question.
- Report each item with `acceptance item`, `status`, `evidence`, and `gap`, and add `verification basis` or `guarantee limits` when they affect the acceptance judgment.
