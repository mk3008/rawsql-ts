# Codex Agents And Skills Review

Date: 2026-05-09

## Goal

Capture which Codex rules should stay in repository policy and which longer workflows should move into dedicated docs or skills.

## What Recent Work Repeatedly Surfaced

### Scaffold and published-package drift

Recent `ztd init` and published-package smoke work keeps reinforcing the same contract across:

- scaffold code
- scaffold-facing README guidance
- published-package smoke checks

That alignment is a stable repository rule, so it belongs in `AGENTS.md`.

### Overwrite-safety expectations

The published-package smoke explicitly proves that `ztd init` must not overwrite existing DDL unless `--force` is used.

That expectation is stable repository policy, so it belongs in `AGENTS.md`.

### Local-source fail-fast guidance

The local-source guard spends significant effort making dependency and CLI-entry failures explicit and actionable.

That expectation is stable repository policy, so it belongs in `AGENTS.md`.

### Long starter and AI onboarding prompts

Starter flow steps, DB-free versus DB-backed branches, smoke-feature graduation, and prompt-dogfooding procedures are long operational guidance that naturally evolves.

Those items should stay out of `AGENTS.md` and live in dedicated docs or skills.

## Proposed AGENTS.md Boundary

Keep `AGENTS.md` short and policy-oriented:

1. Keep scaffold code, scaffold-facing docs, and published-package smoke checks aligned when they describe the same workflow.
2. Do not overwrite scaffold-owned or user-authored files without an explicit force path.
3. Fail fast on local-source dogfooding errors and include the next recovery step.
4. Prefer repository-visible verification over narrative confidence.
5. Keep starter walkthroughs and prompt playbooks out of `AGENTS.md`.

## Proposed New Skills

### `ztd-published-package-smoke`

Purpose:
Run and interpret tarball-based scaffold validation, workspace-protocol checks, npm and pnpm consumer smoke, and overwrite-safety checks.

Expected benefit:
Reduce repeated review comments around contract drift, incomplete release-surface proof, and duplicated helper logic.

### `ztd-starter-ai-onboarding`

Purpose:
Handle the starter path after `ztd init --starter`, including DB-free smoke, DB-backed smoke, `.env` setup, first feature scaffold, and smoke-feature cleanup.

Expected benefit:
Move long evolving onboarding text out of `AGENTS.md` and out of hard-coded prompt fragments.

### `ztd-prompt-dogfooding`

Purpose:
Capture prompt review and debugging flows currently represented by `PROMPT_DOGFOOD.md` style guidance.

Expected benefit:
Separate stable repository rules from prompt-tuning procedures that change more often.

### `skill-maintenance-audit`

Purpose:
Review local skill inventory for overlap, overlong `SKILL.md` files, missing forward-test evidence, and reference-vs-core-content drift.

Expected benefit:
Turn this recurring audit into a repeatable workflow instead of re-deriving the review criteria each time.

## Skills To Merge Or Reframe

### `orchestrator` and `triage`

Recommendation:
Merge them or extract one shared routing rubric.

Rationale:
Both classify maturity and choose the next skill, so they often restate the same judgment without adding new information.

### `reporting` and `pr-writing`

Recommendation:
Keep `reporting` as the canonical evidence skeleton and make `pr-writing` a thin PR renderer.

Rationale:
Both currently require nearly the same evidence and reviewer-facing fields.

### `self-review` and `dogfooding`

Recommendation:
Share one independent-review rubric with separate modes for self-pass versus worker/evaluator separation.

Rationale:
Both re-check evidence quality, claim overreach, blocker status, and reviewer confidence shape.

## Skills To Split

### `skill-creator`

Recommendation:
Split skill creation from skill maintenance and audit guidance.

Rationale:
The current skill is large and mixes initialization, editing, validation, forward-testing, and ongoing lineup maintenance.

## Expected Benefit

- Keeps `AGENTS.md` stable and reviewable.
- Moves long, changing workflows into purpose-built skills.
- Reduces repeated review comments about prompt drift and duplicated routing logic.
- Makes future Codex onboarding and release-surface checks easier to verify.

## Verification Basis

This review was derived from inspection of:

- `packages/ztd-cli/src/commands/init.ts`
- `packages/ztd-cli/templates/scripts/local-source-guard.mjs`
- `scripts/verify-published-package-mode.mjs`
- the current local Codex skill definitions used in this environment

No product behavior changed in this review document; it records guidance and workflow recommendations.
