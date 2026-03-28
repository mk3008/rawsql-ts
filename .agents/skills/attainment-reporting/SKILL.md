---
name: developer-attainment-reporting
description: Report per-item attainment for completed rawsql-ts developer work.
---

# Attainment Reporting

Use this skill when a rawsql-ts developer task is ready to be summarized in a PR or review report that a reviewer can use as an acceptance decision document, not as a work log.

## Use It For
- Mapping each acceptance item to `done`, `partial`, or `not done`.
- Capturing evidence for each status.
- Making the source issue, why it matters, and the guarantee limits visible in the report.
- Explaining what was better than manual work and what remained insufficient.
- Writing PR text as an acceptance judgment document, not a work log.

## Workflow
1. State the source issue and why it matters.
2. List the acceptance items from the plan.
3. Map each item to a status.
4. Add the verification basis and evidence that justify the status.
5. State the guarantee limits for each item when needed.
6. Call out what was better than manual work.
7. Call out what was still insufficient and whether follow-up is needed.

## Output Shape
- Source issue
- Why it matters
- Acceptance items
- Verification basis
- Guarantee limits
- Outstanding gaps
- Acceptance items status
- Outcome
- Attainment level
- Follow-up

## Constraints
- Keep the report explicit and itemized.
- Do not hide partial completion behind a summary sentence.
- Do not force the reviewer to reconstruct the issue or acceptance criteria from context.
- Report each item with `acceptance item`, `status`, `evidence`, and `gap`, and add `verification basis` or `guarantee limits` when they affect the acceptance judgment.
