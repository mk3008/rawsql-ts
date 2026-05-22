---
name: broad-generated-diff-review-packet
description: Prepare scoped review packets for broad rawsql-ts diffs with generated API docs, generated review pages, mass removals, or many package/docs changes. Use when a PR is likely to exceed reviewer or review-tool limits, when generated files dominate the diff, or when reviewers need a focused map from source changes to generated artifacts and verification gates.
---

# Broad Generated Diff Review Packet

Use this skill before PR handoff when the diff is large enough that normal review tools may skip files or reviewers cannot judge the change from one flat summary.

## Workflow

1. Classify changed files into source, generated artifacts, fixtures, docs, tests, package metadata, and workflow/CI.
2. Identify the smallest source changes that explain each generated artifact group.
3. Decide whether the work should be split before PR. Split when unrelated source decisions are mixed or generated churn hides a separate behavior change.
4. If the PR remains broad, prepare a review packet that names review slices, expected generated drift, and verification commands per slice.
5. Call out review-tool limits or skipped files as a risk when they occurred or are likely.
6. Keep the PR body focused on source intent, generated artifact provenance, verification gates, and remaining review gaps.

## Review Packet Shape

- Source intent
- Diff slices
- Source files for each slice
- Generated or derived files for each slice
- Reviewer entry points
- Verification commands per slice
- Generated drift expectations
- Review-tool limits or skipped-file risk
- Recommended split or keep-together decision

## Split Heuristics

Prefer splitting when:

- generated docs/API output is mixed with unrelated product behavior;
- package removals, package additions, and docs migrations can be reviewed independently;
- review tooling reports too many files or skips the PR;
- a follow-up can be verified without the current broad change.

Keep together when:

- generated artifacts are deterministic output from one source migration;
- splitting would create unreproducible intermediate states;
- one verification command proves the complete source-to-generated path.

## Constraints

- Do not use a broad PR body as a substitute for source-to-generated traceability.
- Do not claim generated artifacts were reviewed if the review only inspected source files.
- Do not hide skipped review-tool coverage; report it as a review gap or explain why repository verification is enough.
