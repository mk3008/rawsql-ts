---
title: Release And Merge Readiness
---

# Release And Merge Readiness

Use the PR readiness contract when a change could otherwise rely on free-form review prose.

The goal is simple:

- baseline exceptions must be explicit and tracked
- CLI migration work must ship with the user-facing transition story
- scaffold changes must show the same minimum contract proof every time

## Merge Readiness

Every PR must choose exactly one merge-readiness path in the PR template.

- `No baseline exception requested.` means the PR is not relying on unrelated baseline failures as part of the merge rationale.
- `Baseline exception requested and linked below.` means the PR is using a narrow exception path and must fill in:
  - `Tracking issue`
  - `Scoped checks run`
  - `Why full baseline is not required`

The exception path is for tracked remediation only.
It is not a substitute for a green baseline, and it should not appear as free-form prose somewhere else in the PR body.

## CLI Surface Migration

When the PR changes a user-facing CLI surface, the PR body must either explain why no migration packet is needed or complete the packet.

The migration packet fields are:

- `Upgrade note`
- `Deprecation/removal plan or issue`
- `Docs/help/examples updated`
- `Release/changeset wording`

Use this for flag renames, deprecations, behavior changes that alter command expectations, or documentation/help changes that materially affect how users invoke the CLI.

## Scaffold Contract Proof

When the PR changes scaffold behavior, the PR body must either explain why scaffold proof is not required or provide all three proof classes:

- `Non-edit assertion`
- `Fail-fast input-contract proof`
- `Generated-output viability proof`

The point is to keep scaffold reviews grounded in reusable invariants instead of one-off reviewer reminders.

Typical examples:

- non-edit assertion: parent `boundary.ts` remains untouched when adding a child query boundary
- fail-fast input-contract proof: invalid `queries/` shape or missing `boundary.ts` exits early
- generated-output viability proof: scaffold output includes the files/imports/runtime pieces needed for the generated slice to be usable

## CI Contract

`PR Check` now runs `scripts/check-pr-readiness.js` on every pull request.

That check:

- reads the PR body from `GITHUB_EVENT_PATH`
- classifies changed files
- requires the CLI migration section when CLI-facing files changed
- requires the scaffold proof section when scaffold-related files changed
- rejects baseline exceptions that are not linked to tracked remediation

The PR template is the author-facing entry point.
The CI check is the merge-facing enforcement point.
