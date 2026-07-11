# AST Analysis Paired Runner

Status: benchmark protocol tooling. No product optimization is approved or
implemented.

This runner makes the accepted staged protocol executable for one future AST
candidate. It keeps the P0 PR sampling, seven-scenario corpus, direct phase
boundaries, distinct-input policy, semantic projections, and raw samples. It
does not run the full profile or produce an adoption decision.

## What It Runs

The runner has two fixed stages:

- `screen`: one adjacent baseline/candidate pair;
- `confirmation`: three adjacent pairs ordered baseline/candidate,
  candidate/baseline, baseline/candidate.

Each condition is a separate Node.js process. Every process uses four warmup
samples, 20 measured samples, and eight invocations per sample. Phase scope can
be narrowed, but every declared phase always runs all seven P0 scenarios.

Before the first timed process, the runner requires and records:

- one candidate ID, kind, summary, hypothesis, base commit, candidate commit,
  and limitation;
- clean baseline and candidate worktrees pinned to those commits;
- a declared phase scope and a reason why it is sufficient;
- one positive practical threshold in mean milliseconds for every declared
  phase/scenario row;
- the accepted protocol fingerprint, P0 range reference, benchmark source
  fingerprint, environment, PR sampling, and planned condition order.

Admission failure starts no benchmark process. Baseline and candidate must use
the same benchmark source so a candidate cannot change its own measurement
contract.

## Manifest

Create an ignored manifest under `tmp`. This one-phase example shows every
required threshold row; replace the commits, directories, candidate metadata,
scope, rationale, and thresholds before timing a real candidate.

```json
{
  "schemaVersion": 1,
  "stage": "screen",
  "candidate": {
    "id": "candidate-name",
    "kind": "candidate",
    "summary": "One benchmark candidate and no unrelated change.",
    "hypothesis": "The named phase should require less mean time.",
    "baseCommit": "0000000000000000000000000000000000000000",
    "candidateCommit": "1111111111111111111111111111111111111111",
    "limitation": "The result applies only to the declared phase and P0 corpus."
  },
  "baselineDirectory": "C:/work/rawsql-ts-baseline",
  "candidateDirectory": "C:/work/rawsql-ts-candidate",
  "phaseScope": ["renderer.print"],
  "scopeRationale": "The candidate changes only SqlPrinter traversal; shared token construction and formatter code are unchanged.",
  "practicalThresholds": [
    { "phase": "renderer.print", "scenario": "tracked.customer-summary", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "tracked.product-ranking", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "tracked.sales-summary", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "synthetic.cte-wildcard-duplicate", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "synthetic.wide-output", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "synthetic.boolean-parameter-comment", "minimumAbsoluteMeanDeltaMs": 0.01 },
    { "phase": "renderer.print", "scenario": "synthetic.derived-union", "minimumAbsoluteMeanDeltaMs": 0.01 }
  ]
}
```

Use all six phase names when the affected boundary cannot be justified
narrowly. Scenario filtering is intentionally unavailable.

## Commands

Install the locked workspace dependencies in the controller, baseline, and
candidate worktrees before admission:

```powershell
pnpm install --frozen-lockfile
```

Run the declared screen:

```powershell
pnpm benchmark:ast-paired -- --manifest=tmp/ast-candidate-screen.json
```

If a decision is still wanted after the retained screen, commit its appended
candidate-record line in a controller worktree that is separate from the
commit-pinned baseline and candidate worktrees. Create a new manifest with
`"stage": "confirmation"` and
`"screenRunId": "<the-screen-run-id>"`, then run the same command. Do not edit
the screen record. Before timing, confirmation resolves that tracked screen
line and requires the exact same candidate metadata, commits, phase scope,
scope rationale, practical thresholds, P0 range-reference fingerprint, and
protocol fingerprints. The runner reads the screen from committed `HEAD` and
rejects an untracked or modified candidate record. A failed or semantically
invalid screen cannot admit confirmation.

The runner writes an admission snapshot, one raw benchmark JSON and one process
log per condition, and a paired summary under:

```text
tmp/ast-analysis-paired-runs/<timestamp>-<candidate-id>/
```

These ignored raw artifacts are evidence and must be retained even when the
candidate is adverse, neutral, inconclusive, semantically invalid, or stopped
early.

## Semantic Gate

P0 checks every invocation against an expected sink generated inside the same
condition. The paired runner additionally exact-compares the complete baseline
and candidate sink for each phase/scenario row. This cross-condition comparison
detects a candidate that changes semantics consistently.

The comparison retains collector order, duplicates, output indexes, aliases,
sources, and formatted value SQL; integrated-condition SQL, phases,
applied/skipped details, safety, diagnostics, and parameters; and renderer SQL
and parameter order. A mismatch stops later pairs, retains all available raw
and process artifacts, records `semantic_mismatch`, and produces no speed
verdict.

## Status and Threshold Rules

Every candidate record contains all 42 P0 phase/scenario rows. Rows outside the
declared phase scope and rows not reached after a stop are `not_measured` with
a reason.

Allowed performance statuses are:

- `repeatable_signal`;
- `adverse_signal`;
- `neutral_or_inconclusive`;
- `semantic_mismatch`;
- `not_measured`.

A one-pair screen records the numeric direction but cannot establish favorable
or adverse performance effect. A three-pair confirmation calls a scenario
`repeatable_signal` only when all three candidate-minus-baseline mean deltas are
favorable and their median absolute magnitude exceeds both that row's
predeclared practical threshold and its retained P0 between-process mean range.
`adverse_signal` uses the symmetric adverse rule. Every other completed row is
`neutral_or_inconclusive`.

The machine-readable P0 ranges are tracked in
`docs/bench/ast-analysis-phase-p0-reference.json`. They reproduce the min/max
ranges in the P0 report and are pinned to the P0 commit and accepted protocol
document fingerprint.

## Append-Only Candidate Record

After every admitted run, the runner appends exactly one JSON object to:

```text
docs/bench/ast-analysis-benchmark-candidate-records.jsonl
```

Each line includes candidate and base commits, manifest and protocol
fingerprints, declared phase scope, scope rationale, actual condition order,
commands, environments, every raw artifact path, all 42 scenario statuses,
sink comparison, thresholds, P0 ranges, escalation decision, and a plain-language
limitation.

The file is append-only:

- do not replace, reorder, or delete an earlier line;
- do not remove an adverse, neutral, inconclusive, mismatch, or failed run;
- append a new line for a corrected manifest, rerun, confirmation, rejection,
  or defer decision;
- do not replace scenario rows with an aggregate workload mean.

Raw artifacts are ignored local evidence; the JSONL line is the tracked index
that makes their existence and outcome visible. Reviewers must treat a missing
raw artifact as an evidence gap, not reconstruct or relabel the result.

## Self-Comparison Demonstration

The tracked first candidate record is a one-phase, one-pair
`self_comparison`. Its baseline and candidate conditions use the same clean
commit and benchmark implementation. It exercises admission, alternating
execution, raw retention, seven cross-condition sink comparisons, and the
42-row record without changing or measuring an optimization candidate.

All self-comparison performance rows are `not_measured` even though raw timing
deltas are retained. The demonstration does not claim a speedup, regression,
neutral effect, or no-material-effect conclusion.

## Decision Limit

A favorable confirmation is not an adoption decision. The accepted protocol
still requires the full six-phase profile when its escalation conditions apply.
This runner deliberately does not invoke that profile, change product code,
or perform causal profiling.
