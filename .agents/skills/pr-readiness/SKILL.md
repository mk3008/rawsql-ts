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

## Workflow
1. Read `.github/pull_request_template.md`.
2. Preserve every template section unless a repository script explicitly says it is optional.
3. Read `scripts/check-pr-readiness.js` when it exists.
4. Classify the changed files with the script rules, not memory.
5. Fill exactly one checkbox in each required choice group:
   - `Merge Readiness`
   - `CLI Surface Migration` when CLI-facing files changed
   - `Scaffold Contract Proof` when scaffold-related files changed
6. Fill required same-line fields exactly as labels appear in the template.
7. Before or immediately after `gh pr create` / `gh pr edit`, run the readiness script against the PR body.
8. Do not present the PR as ready while the readiness script fails.

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

## Output Shape
- Template sections preserved
- Required gates selected
- Required fields filled
- Local readiness command
- Readiness result
- Remaining blockers

## Constraints
- Do not replace the repository template with a free-form PR body.
- Do not rely on memory for required section names or checkbox labels.
- Do not mark a PR `ready` based only on focused tests when `check-pr-readiness.js` is failing.
