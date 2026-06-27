---
name: changeset-classification
description: Classify and review rawsql-ts Changeset entries for patch, minor, major, no-release, stale entries, public API additions, bug fixes, docs/demo updates, and reviewer comments that challenge release-note wording or bump level.
---

# Changeset Classification

Use this skill when adding, editing, removing, or reviewing `.changeset/*.md` files, or when a reviewer questions whether a rawsql-ts change is patch, minor, major, or no-release.

## Workflow

1. Identify changed packages and whether the change affects published behavior, public API, CLI surface, scaffold output, docs/demo only, or internal tests.
2. Classify the bump:
   - `patch`: backward-compatible bug fix or documentation for an already released surface.
   - `minor`: backward-compatible public API, option, output field, syntax support, CLI capability, or scaffold capability addition.
   - `major`: breaking API, CLI, scaffold, runtime, or documented behavior change.
   - `no-release`: repository-only workflow, CI, tests, or unpublished/internal-only maintenance.
3. Check whether the changeset wording describes user-visible behavior rather than implementation mechanics.
4. Check for stale entries that mention removed packages, superseded behavior, or a task no longer in the diff.
5. If an automated reviewer suggests a different bump, verify the underlying semver reason before accepting or rejecting it.

## Output Shape

- Changed package
- Release surface
- Recommended bump
- User-visible wording
- Stale or conflicting changesets
- Reviewer comments accepted or rejected
- Rationale

## Constraints

- Do not add a changeset just to satisfy habit when no published package changes.
- Do not downgrade an additive public API to patch solely because it is backward compatible.
- Do not let release wording claim guarantees that tests or docs do not support.
- Do not keep stale changesets for packages or behavior outside the final diff.
