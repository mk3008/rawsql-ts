---
name: review-tool-volume-management
description: Manage rawsql-ts external review-tool usage for CodeRabbit or similar AI review bots when PRs are stacked, small, generated, broad, rate-limited, or likely to consume review quota before the branch is ready.
---

# Review Tool Volume Management

Use this skill before requesting external AI review, when CodeRabbit reports rate limits, or when a branch is being updated repeatedly before it is ready for human review.

## Workflow

1. Decide whether the PR is ready for external review:
   - implementation complete,
   - focused verification run,
   - PR readiness body validated,
   - self-review blockers resolved or surfaced.
2. If the PR is still changing quickly, avoid manual review triggers until the next ready checkpoint.
3. For stacked or closely related small PRs, request review on the PR where the source decision is clearest, then use the review result to update the rest.
4. For generated or broad diffs, use `broad-generated-diff-review-packet` before requesting bot review.
5. When a rate-limit comment appears, record it as review coverage unavailable, not as a code finding.
6. If review is still needed after the refill window, trigger one review after the branch and PR body are stable.
7. Do not treat `COMMENTED` bot review states as approval.

## PR Notes

Mention review-tool limits only when they affect review confidence. Keep the note short:

- `External AI review was rate-limited; repository checks and self-review are the current evidence.`
- `External AI review requested after readiness validation.`

## Constraints

- Do not spend review quota on WIP pushes when local checks or PR readiness are still failing.
- Do not hide skipped or rate-limited review coverage if the final claim depends on it.
- Do not copy bot marketing, tips, or generated poems into repository evidence.
