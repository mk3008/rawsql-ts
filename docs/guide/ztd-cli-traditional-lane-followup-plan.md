# ztd-cli Traditional Lane Follow-up Plan

This document defines the follow-up expansion plan for exposing `ztd | traditional` test lanes in `ztd-cli`.
It is intentionally scoped as a design/plan artifact, not an implementation commit.

## Status

- Current status: `done` (planning artifact for Issue #767)
- Implementation status: `not done` (separate issues/PRs are expected)

## Objective

Enable `ztd-cli` users to choose a test lane (`ztd` or `traditional`) per query/test intent without moving mode implementation responsibility into CLI.

## User Value

- Keep fast contract validation in ZTD lane.
- Use traditional lane for migration/seeding/index/physical-state verification.
- Select the right lane per query or test file based on purpose.
- Make the selected lane traceable from scaffold layout and test evidence.

## Non-Goal

- Do not re-implement mode runtime behavior in CLI.
- Do not make this issue a delivery gate for starter acceptance, `mode=ztd` evidence rollout, or SQL trace rollout.

## Current Baseline (Observed in `ztd-cli`)

- `feature tests scaffold` currently emits ZTD-only entrypoints and metadata:
  - `<query>.boundary.ztd.test.ts`
  - `generated/TEST_PLAN.md` with `testKind: ztd`
  - `generated/analysis.json` with `testKind: ztd`
- Existing behavior and generated assets are tested as ZTD-first contracts.

## CLI Surface Proposal

### Proposed Option

Add a `--test-kind` selector to `feature tests scaffold`.

```bash
ztd feature tests scaffold --feature <feature-name> --test-kind ztd
ztd feature tests scaffold --feature <feature-name> --test-kind traditional
```

- Allowed values: `ztd | traditional`
- Default: `ztd` (for backward compatibility and onboarding simplicity)
- Keep existing invocations valid when `--test-kind` is omitted.

### Optional Future Extension

If multi-lane generation in one run becomes useful:

```bash
ztd feature tests scaffold --feature <feature-name> --test-kind both
```

`both` is explicitly out of initial scope to keep behavior predictable.

## Coexisting Scaffold Layout

Two layout candidates were compared.

### Candidate A: File Suffix (Recommended)

```text
src/features/<feature>/queries/<query>/tests/
  <query>.boundary.ztd.test.ts
  <query>.boundary.traditional.test.ts
  cases/
  generated/
    TEST_PLAN.ztd.md
    TEST_PLAN.traditional.md
    analysis.ztd.json
    analysis.traditional.json
```

Benefits:

- Preserves current directory shape.
- Easy per-file lane selection in editor/CI.
- Lower migration cost from existing ZTD-only scaffold.

Costs:

- More files in one directory.
- Requires lane-aware naming discipline.

### Candidate B: Lane Directories

```text
src/features/<feature>/queries/<query>/tests/
  ztd/
    <query>.boundary.test.ts
    cases/
    generated/
  traditional/
    <query>.boundary.test.ts
    cases/
    generated/
```

Benefits:

- Strong physical separation by lane.
- Clear ownership per lane.

Costs:

- Larger scaffold diff footprint.
- Higher risk of duplicated helper paths and import churn.
- Harder backward compatibility with current single-lane structure.

### Decision

Start with Candidate A (suffix strategy). Revisit directory strategy only if suffix-based growth becomes unmanageable.

## Responsibility Boundary (CLI vs Library)

- Library owns execution mode semantics (`ztd | traditional` runtime behavior).
- CLI owns:
  - lane selection UX (`--test-kind`)
  - lane-specific scaffold wiring (entrypoints, generated plan/analysis files)
  - evidence visibility in scaffold artifacts
- Generated helpers for both lanes must stay thin adapters that call library mode APIs.
- CLI must not re-implement migration/seeding/cleanup internals.

## Mode Switching Granularity

Recommended policy:

- Primary switching unit: test file.
- Practical organization unit: query boundary.
- Optional coordination unit: feature-level conventions (documented, not enforced).

Rationale:

- Test-file switching allows mixed intent within one query boundary.
- Query-level default still stays readable in filesystem layout.

## Traditional Lane Adapter Policy

- Traditional lane entrypoints must call the same library-facing boundary contract style as ZTD lane.
- Only lane-specific wiring changes are allowed (e.g., runner selection and evidence tags).
- No independent lifecycle stack in generated CLI helpers.

## Starter UX Decision Points

Initial recommendation:

- Starter default remains ZTD-first.
- Mention traditional lane existence in docs/help.
- Do not include full traditional sample by default in starter scaffold.

Decision criteria for exposing traditional by default later:

- onboarding complexity delta
- maintenance overhead of dual-lane starter artifacts
- support request frequency for physical-state verification

## Evidence Contract Alignment

Lane coexistence should preserve machine-readable evidence alignment.

- ZTD lane keeps current expectations (`mode=ztd`, `physicalSetupUsed=false`).
- Traditional lane must emit its own lane-consistent evidence contract and clear metadata separation.
- Generated artifacts should be lane-qualified so CI/reporting can summarize by lane without ambiguity.

## Acceptance Criteria for Follow-up Implementation

- CLI surface explicitly documents and supports `--test-kind ztd|traditional` with default `ztd`.
- Coexisting scaffold strategy is implemented with explicit trade-off rationale preserved.
- CLI-library responsibility boundary remains intact.
- Traditional generated helper path stays a thin library-mode adapter.
- Mode switching policy at query/test-file level is documented and testable.
- Starter UX decision is documented with explicit criteria.

## Verification Plan (Prototype/Implementation Phase)

- Unit tests for argument parsing and defaults (`--test-kind` behavior).
- Snapshot/fixture tests for generated file names and lane-qualified artifacts.
- Regression tests proving omitted `--test-kind` matches current ZTD behavior.
- Contract tests that generated helpers call library mode APIs rather than local lifecycle logic.
- Evidence-schema tests verifying lane-disambiguated output.

## Scope In

- CLI surface design for traditional test kind
- Coexisting lane scaffold design
- Query/test-file mode switching policy
- Starter exposure decision framework

## Scope Out

- Immediate starter acceptance gate implementation
- Immediate `mode=ztd` evidence rollout changes
- Immediate opt-in SQL trace rollout changes
- Immediate first-pass mode delegation restructuring

## Risks

- UX expansion before boundary hardening may reintroduce CLI responsibility creep.
- Coexisting lane files can increase scaffold complexity if naming rules are weak.
- Overexposing traditional lane too early may degrade first-run onboarding.

## Open Questions

- Should feature-level defaults be configurable, or only test-file explicit?
- Is suffix naming enough for long-lived repos, or will directory lanes become necessary?
- Where should lane summary live first: CLI output, JSON artifact, or generated docs?
- What is the minimum traditional evidence contract needed for release confidence?
