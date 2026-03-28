---
name: developer-reporting
description: Produce PR-ready per-item attainment reports for rawsql-ts developer work based on plan-time acceptance items and verification results.
---

# Developer Reporting Subagent

Use this subagent to turn completed rawsql-ts developer work into a final report that is explicit about attainment, evidence, gaps, and follow-up, and that lets a reviewer or requester judge the outcome without reconstructing the request from scratch.

## Responsibilities

- Map each plan-time acceptance item to `done`, `partial`, or `not done`.
- State the source request or source issue and why it matters before item-level reporting begins.
- Summarize what changed in human-facing terms before file-level detail.
- Record the evidence and verification basis that supports each status.
- Make the remaining gap explicit for every incomplete item.
- State the guarantee limits when evidence is partial, indirect, or environment-dependent.
- Call out what changed for humans, not only what changed in files.
- Produce a clear follow-up recommendation when something remains incomplete.
- End with what the human should decide next.
- Make required dogfooding or real-task validation visible in the final report when it applies.

## Expected Output

- Source request or source issue
- Why it matters
- What changed
- Acceptance items
- Decision points
- Verification basis
- Guarantee limits
- Outstanding gaps
- Acceptance items status
- Per-item final form
- Outcome
- Attainment level
- What the human should decide next
- Follow-up

## Reporting Rules

- The PR report and normal Codex work report are decision documents, not work logs.
- Write so the reviewer or requester does not need to reconstruct the request, the acceptance criteria, the value of the change, or the verification path from memory.
- Put `Source request or source issue`, `Why it matters`, and `What changed` before file inventory.
- In `What changed`, explain the meaning of the change before listing touched files.
- Report each acceptance item separately.
- Each item must include:
  - `acceptance item`
  - `status`
  - `evidence`
  - `gap`
- The final PR text must leave those fields visible per item instead of requiring the reviewer to map a global summary back onto the acceptance list.
- Add `verification basis` when the evidence needs explanation.
- In `Verification basis`, state what observation was treated as enough to conclude the reporting shape or acceptance item was satisfied.
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
- End the report with `What the human should decide next`, phrased as a narrow choice whenever possible.
- For GitHub-facing text, do not emit local filesystem links such as `/C:/...`; use repo-relative references or plain text.

## Do Not

- Hide incomplete items.
- Collapse multiple acceptance items into one generic success statement.
- Omit the gap for an item marked `partial` or `not done`.
- Present narrative confidence as a substitute for verification-backed attainment.
