---
name: developer-pr-readiness
description: Prepare rawsql-ts pull requests with the repository PR template and local readiness gate so required merge, CLI migration, and scaffold proof sections are not missed.
---

# PR Readiness

Use this skill before creating or editing a rawsql-ts pull request.

## Use It For
- Creating a PR body.
- Editing an existing PR body after CI or reviewer feedback.
- Any PR that changes CLI-facing files, scaffold behavior, release readiness, or documentation used by those gates.
- Deciding whether a PR is ready to request external AI review after the body is validated.

## Workflow
1. Read `.github/pull_request_template.md`.
2. Preserve every template section unless a repository script explicitly says it is optional.
3. Read `scripts/check-pr-readiness.js` when it exists.
4. Classify the changed files with the script rules, not memory.
5. Fill exactly one checkbox in each required choice group:
   - `Merge Readiness`
   - `CLI Surface Migration` when CLI-facing files changed
   - `Scaffold Contract Proof` when scaffold-related files changed
6. Fill required same-line fields exactly as labels appear in the template, including `Self-review workflow:`, `Self-review result:`, `Concept-review workflow:`, and `Concept-review result:`.
7. Draft the complete PR body, run the consistency and concept-boundary review cycles, then run the pre-PR retro gate and human-acceptance review over the verified implementation and that exact draft.
8. Resolve blockers, rerun affected verification, and update the PR body. If the implementation or PR body changes, rerun every affected review gate, including consistency, concept-boundary, pre-PR retro, and human-acceptance review.
9. Before `gh pr create` / `gh pr edit`, validate the final reviewed PR body by running the readiness script locally.
10. If requesting CodeRabbit or similar external AI review, use `review-tool-volume-management` after the body passes readiness validation.
11. Do not present the PR as ready while self-review has unresolved blockers or the readiness script fails.

## Local Validation
When validating a PR body locally, create a temporary event payload containing the PR body, then run:

```bash
node scripts/check-pr-readiness.js --base-sha <base-sha> --head-sha <head-sha> --event-path <temp-event-json>
```

Use the actual base and head SHAs from the PR or from `git merge-base` / `git rev-parse HEAD`.

## Failure Handling
- If CI reports a PR readiness failure, fix the PR body first.
- If the failure is caused by missing template sections, treat it as an authoring process defect, not a product-code defect.
- If the current task caused the miss, add or update a repo-local skill or AGENTS rule before claiming the prevention is durable.
- If a reviewer finds a correctness issue after the PR is opened, treat that as evidence that the finishing self-review pass was missing or too weak; update this skill or the relevant review checklist when the miss is reusable.

## Output Shape
- Template sections preserved
- Required gates selected
- Required fields filled
- Self-review workflow and result recorded in the PR body
- Concept-review workflow and result recorded in the PR body
- Self-review blockers resolved or explicitly surfaced
- Concept or package-boundary violations resolved or explicitly surfaced
- Local readiness command
- Readiness result
- Remaining blockers
- External review request timing, when relevant

## Constraints
- Do not replace the repository template with a free-form PR body.
- Do not rely on memory for required section names or checkbox labels.
- Do not mark a PR `ready` based only on focused tests when `check-pr-readiness.js` is failing.
