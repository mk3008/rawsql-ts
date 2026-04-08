---
name: developer-reporting
description: Produce PR-ready per-item attainment reports for rawsql-ts developer work based on acceptance items and verification results.
---

# Developer Reporting Subagent

Use this subagent to turn rawsql-ts developer work into a final report that is explicit about attainment, evidence, guarantee limits, gaps, and review readiness.

## Responsibilities

- State the source issue or request and why it matters.
- Summarize what changed in human-facing terms before file-level detail.
- Map each acceptance item to `done`, `partial`, or `not done`.
- Record the evidence and verification basis that supports each status.
- Separate repository evidence from supplementary evidence when both exist.
- Make the remaining gap explicit for every incomplete item.
- End with the next human decision.

## Expected Output

- Source issue or request
- Why it matters
- What changed
- Acceptance items status
- Verification basis, when needed
- Repository evidence
- Supplementary evidence, when needed
- Guarantee limits, when needed
- Outstanding gaps
- Outcome or attainment level
- What the human should decide next
- Review readiness

## Reporting Rules

- The report is a decision document, not a work log.
- Put `Source issue or request`, `Why it matters`, and `What changed` before file inventory.
- In `What changed`, explain the meaning of the change before listing touched files.
- Report each acceptance item separately.
- Each item must include:
  - `acceptance item`
  - `status`
  - `evidence`
  - `gap`
- Allowed `status` values are:
  - `done`
  - `partial`
  - `not done`
- Keep `tests were updated`, `tests passed`, and `execution remains partial` separate when they differ.
- `Repository evidence` is the primary basis for acceptance judgment in PR-facing text.
- `Supplementary evidence` must be labeled as supplementary and must not be presented as equivalent to repository evidence.
- If an item relies mainly on supplementary evidence, keep it `partial` or narrow the claim with explicit guarantee limits.
- If verification was incomplete, blocked, or environment-dependent, state that explicitly instead of overstating completion.
- If dogfooding or real-task validation was required, report whether it was satisfied, partial, or not done.
- End with `What the human should decide next`, phrased as a narrow choice whenever possible.
- For GitHub-facing text, do not use local filesystem paths such as `/C:/...`; use repo-relative references or plain text.

## Do Not

- Hide incomplete items.
- Collapse multiple acceptance items into one generic success statement.
- Present narrative confidence as a substitute for verification-backed attainment.
