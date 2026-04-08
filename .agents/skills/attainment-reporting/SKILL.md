---
name: developer-attainment-reporting
description: Report per-item attainment for completed rawsql-ts developer work.
---

# Attainment Reporting

Use this skill when a rawsql-ts developer task is ready to be summarized in a PR or normal Codex work report that a human can use as a decision document, not as a work log.

If the task used `tmp/RETRO.md` or the retro gate changed the final attainment claim, read [references/retro-final-report-example.md](references/retro-final-report-example.md) before drafting the final form.

## Use It For
- Mapping each acceptance item to `done`, `partial`, or `not done`.
- Capturing evidence for each status.
- Separating repository evidence from supplementary evidence so PR reviewers can tell what they can verify directly.
- Making the source request or source issue, why it matters, and the guarantee limits visible in the report.
- Making the actual change and the next human decision visible without forcing the reader to reconstruct context.
- Explaining what was better than manual work and what remained insufficient.
- Writing PR text and normal Codex reports as acceptance or operator decision documents, not work logs.
- Preparing final text for self-review before it is shown to a human reviewer or requester.

## Workflow
1. State the source request or source issue and why it matters.
2. Summarize what changed in terms of user-visible or reviewer-visible meaning before any file-level detail.
3. List the acceptance items or decision points from the plan.
4. Map each acceptance item to a status.
5. For each acceptance item, add the evidence and gap needed for final judgment.
6. Separate `Repository evidence` from `Supplementary evidence` when both exist.
7. Add verification basis that explains what counted as sufficient for the shape or the item.
8. State the guarantee limits for each item or for the report when needed.
9. Call out what was still insufficient and whether follow-up is needed.
10. Run consistency review and human acceptance review before treating the report as ready.
11. End with what the human should decide next in a narrow choice whenever possible.

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
- Per-item final form
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
- The final report form MUST include every acceptance item as `acceptance item`, `status`, `evidence`, and `gap`.
- The final PR text and normal work report MUST show those per-item fields directly in the final output, not only in draft notes or plan artifacts.
- Do not leave evidence and gaps only in a global summary when the reader must map them back to items manually.
- Global `Verification basis`, `Guarantee limits`, and `Outstanding gaps` are supporting sections and MUST NOT replace per-item status.
- In PR text, `Repository evidence` MUST be the primary evidence class for acceptance judgment.
- `Repository evidence` means reviewer-checkable evidence that remains in the repo or CI-visible record, such as code, tests, snapshots, checked-in docs, and CI-visible outputs.
- `Supplementary evidence` means local logs, external observations, manual checks that are not committed, and non-reproducible or environment-specific notes.
- `Supplementary evidence` MUST be labeled as supplementary or supporting material when it appears in PR text.
- `Supplementary evidence` alone MUST NOT justify a strong `done` claim unless the guarantee limits explicitly narrow the claim.
- If repository evidence is missing and only supplementary evidence exists, prefer `partial` or a narrower guarantee-limited claim over a strong `done`.
- Normal Codex work reports may contain more supplementary operational detail, but they still must separate it from repository evidence when completion is being claimed.
- For GitHub-facing text, do not use local filesystem links such as `/C:/...`; use repo-relative references or plain text.
- If a local filesystem path appears in GitHub-facing text, treat the final form as incomplete.
- Distinguish `tests were updated` from `tests passed`.
- If execution is blocked, environment-dependent, or not run, keep the affected item `partial` or `not done` and state the blocker explicitly.
- Final PR text and normal completion reports MUST pass consistency review and human acceptance review before they are treated as ready for human review.
- Review findings MUST be triaged as `blocker`, `follow-up`, or `nit`.
- If a blocker remains, the report MUST not be presented as ready for human review.
