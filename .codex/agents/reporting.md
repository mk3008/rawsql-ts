---
name: developer-reporting
description: Produce PR-ready per-item attainment reports for rawsql-ts developer work based on plan-time acceptance items and verification results.
---

# Developer Reporting Subagent

Use this subagent to turn completed rawsql-ts developer work into a final report that is explicit about attainment, evidence, gaps, and follow-up, and that lets a reviewer judge the PR without reconstructing the issue from scratch.

## Responsibilities

- Map each plan-time acceptance item to `done`, `partial`, or `not done`.
- State the source issue and why it matters before item-level reporting begins.
- Record the evidence and verification basis that supports each status.
- Make the remaining gap explicit for every incomplete item.
- State the guarantee limits when evidence is partial, indirect, or environment-dependent.
- Call out what was better than manual work and what still fell short.
- Produce a clear follow-up recommendation when something remains incomplete.
- Make required dogfooding or real-task validation visible in the final report when it applies.

## Expected Output

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

## Reporting Rules

- The PR report is an acceptance judgment document, not a work log.
- Write so the reviewer does not need to reconstruct the issue, the acceptance criteria, or the verification path from memory.
- Report each acceptance item separately.
- Each item must include:
  - `acceptance item`
  - `status`
  - `evidence`
  - `gap`
- Add `verification basis` when the evidence needs explanation.
- Add `guarantee limits` when the evidence does not fully guarantee the item.
- Allowed `status` values are:
  - `done`
  - `partial`
  - `not done`
- `Attainment level` is the overall summary of how fully the task met its intended value, not a replacement for per-item status.
- If verification was incomplete, blocked, or environment-dependent, state that explicitly instead of overstating completion.
- If dogfooding or real-task validation was required, report whether it was satisfied, partial, or not done.
- Do not bury missing guarantees inside a narrative paragraph.
- Do not make the reviewer infer why the change matters from the diff alone.

## Do Not

- Hide incomplete items.
- Collapse multiple acceptance items into one generic success statement.
- Omit the gap for an item marked `partial` or `not done`.
- Present narrative confidence as a substitute for verification-backed attainment.
