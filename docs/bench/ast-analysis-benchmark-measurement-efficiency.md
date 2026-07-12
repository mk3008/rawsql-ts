# AST Benchmark Measurement-Efficiency Investigation

## Decision Requested

Adopt the staged protocol in this document before attempting an AST-analysis or
renderer optimization. It makes a candidate cheaper to screen while preserving
the P0 phase boundaries, semantic sinks, raw artifacts, and negative, neutral,
or inconclusive outcomes.

This is an investigation and protocol proposal, not a benchmark result and not
approval for a product change. No benchmark harness, product code, fixture,
test, API, generated artifact, QuerySpec, ZTD, database, driver, or rewriter
behavior was changed for this investigation.

## Evidence Provenance And Limits

`P0` below means the accepted benchmark foundation at commit
`c6f28dbbf4594e99a8e1b1ab662334c010bd7281`:

- `benchmarks/ast-analysis-phase-benchmark.ts`
- `docs/bench/ast-analysis-phase-benchmark.md`
- `tmp/orchestration/ast-phase-benchmark-harness/report-attempt-1.yaml`

The P0 Markdown and source are repository evidence for the method and observed
numbers. The handoff report is supplementary task evidence for the accepted
run and its check history. The protocol below is a hypothesis about how to
reduce decision time; it has not been executed and therefore establishes no
speedup.

P0 measured a baseline only. It explicitly concluded `not measured` for every
optimization effect. Its process timestamps and raw artifact sizes are useful
capacity observations, but P0 did not emit elapsed wall-clock durations. This
document consequently expresses expected savings as timed-boundary-call counts,
not as promised seconds.

## What P0 Costs Today

### Measurement Work

P0 has six phase boundaries and seven scenarios, for 42 phase-scenario cells.
The PR profile uses four warmups, 20 measured samples, and eight one-shot
invocations per sample. Therefore one independent PR process performs:

```text
42 cells x (4 warmups + 20 measured samples) x 8 invocations = 8,064 timed boundary calls
42 cells x 20 measured samples = 840 retained raw timing samples
```

The required P0 three-process baseline therefore performs 24,192 timed calls
and retains 2,520 raw samples. Each call receives a distinct AST identity
prepared before timing; after every timed sample batch, all eight results are
projected, serialized, SHA-256 hashed, and deep-compared with the expected
semantic sink. Those checks are deliberately outside the timer but remain real
measurement work that must not be removed to make a result look faster.

The P0 `full` profile would perform 38,976 timed calls per process
(`42 x (8 + 50) x 16`), or 4.83 times the PR-profile call count before its
larger synthetic inputs are considered. The three retained PR raw artifacts
are 71,635–71,719 bytes each. Their report timestamps are 7.733 seconds and
7.752 seconds apart in the sequential three-process command; that spacing is
an observed end-to-end cadence, not a measured per-process duration.

### Measurement Noise

P0 retained rather than filtered noisy observations. Examples include:

| P0 observation | Why it matters for a faster protocol |
| --- | --- |
| Select-output collection had maximum within-process CV 1.55 for `synthetic.derived-union` and 1.32 for `tracked.customer-summary`. | A small apparent collector gain can be smaller than ordinary variation. |
| Renderer print had maximum CV 1.27 for `tracked.sales-summary`; its boolean/comment mean ranged 0.153428–0.237758 ms between processes. | A single process can change the apparent ranking for a sub-millisecond phase. |
| Cold format for `synthetic.derived-union` ranged 0.073793–0.134520 ms, and token build for `tracked.customer-summary` ranged 0.030646–0.056005 ms. | Reducing repetitions or selecting only a favorable run can turn noise into a false speedup. |
| All six P0 phase rows were classified `noisy/inconclusive` for at least one scenario. | A screen can triage work; it cannot by itself establish an optimization effect or no material effect. |

P0 also found all sink signatures identical in all three processes. The
integrated-condition sink retained applied/skipped details, diagnostics, SQL,
and parameter projections; the renderer sinks retained SQL and parameter order;
and the collector sink retained order, duplicates, output index, aliases,
sources, and formatted value SQL. These are non-negotiable evidence, not
optional screen-time overhead.

## Required Invariants

Every future run, including a cheap screen, must retain these P0 invariants:

1. Change exactly one candidate at a time and declare the intended affected
   phase set before measuring.
2. Keep the corpus seed, all seven scenarios, formatter options, direct phase
   boundaries, and distinct pre-parsed AST identity policy unchanged.
3. Do not derive a phase cost by subtracting envelopes. In particular, do not
   subtract renderer time from integrated-condition or cold-format time.
4. Run the same semantic projection, hash, and exact comparison for every
   in-scope invocation. A sink mismatch is a failed candidate, not a timing
   datapoint to omit.
5. Retain every raw process artifact and append every outcome, including
   regression, neutral, and inconclusive outcomes, to the candidate record.
6. Alternate baseline and candidate in each independent process. Never run all
   baselines first and candidates later.

## Staged Decision Protocol

### Stage 0: Admission And Scope Declaration

Before running anything, record the one candidate, base commit, environment,
P0 protocol fingerprint, expected affected phase set, and why other phase
boundaries are unaffected. Also record the candidate-specific practical
threshold for each claimed scenario row. A threshold cannot be loosened after
seeing the result. If no defensible practical threshold is available, the work
may still measure but can conclude only `neutral_or_inconclusive`, never a
performance effect. If shared formatter, AST traversal, collector, or
condition-pipeline code makes the phase explanation uncertain, declare all
affected boundaries; if it cannot be bounded, use the full six-phase matrix.

This stage has no performance verdict. It prevents a narrow screen from being
mistaken for evidence about an unmeasured phase.

### Stage 1: Cheap Screen

Run one alternating baseline/candidate pair for the declared affected phase set
over all seven scenarios, using the unchanged PR sampling parameters (four
warmups, 20 measured samples, eight invocations). For a single phase, that is
1,344 timed calls per condition and 2,688 calls for the pair, instead of 8,064
per condition for the full six-phase PR matrix. Semantic comparisons and raw
artifact retention remain identical for every in-scope call.

The screen produces only one of these statuses:

| Status | Required action | Not allowed |
| --- | --- | --- |
| `semantic_mismatch` | Stop timing, retain the baseline and candidate artifacts, record the mismatch, and repair or reject the candidate. | Re-running until a matching output appears or reporting a speed result. |
| `candidate_to_confirm` | Escalate to Stage 2 whenever a decision is still wanted, regardless of whether one pair appears favorable or adverse. | Calling the result an optimization or a regression decision after one pair. |
| `neutral_or_inconclusive` | Append the result with its raw artifacts. Stop only if the work is being rejected; otherwise escalate when a decision is still wanted. | Deleting it, calling it `no material effect`, or silently trying another candidate under the same label. |

The screen is deliberately allowed to reject a semantic mismatch early. It is
not allowed to accept a performance candidate early. A neutral or unfavorable
screen remains durable evidence even when no confirmation is funded.

### Stage 2: Confirmation

Run three independent alternating baseline/candidate pairs for the same
declared phase set and all seven scenarios, still with unchanged PR sampling,
phase boundaries, and sinks. A one-phase confirmation is 8,064 timed calls
across both conditions, compared with 48,384 calls for a three-process,
six-phase baseline-and-candidate comparison. Its verdict is limited to the
declared phase set and corpus; it is not a whole-library claim.

For each scenario, compare the paired direction and magnitude with the retained
P0 process ranges and the confirmation variation. Report all scenario rows.
A scenario may be called a `repeatable_signal` only when its three pairs have a
consistent favorable direction and its median paired magnitude exceeds both
its predeclared practical threshold and that scenario's retained P0
between-process mean range. A scenario is an `adverse_signal` when it meets
the corresponding adverse threshold; otherwise it is
`neutral_or_inconclusive`. Do not collapse mixed rows into an average. A
candidate is not eligible for an optimization decision unless it has at least
one predeclared repeatable favorable row, no adverse row, and no semantic
mismatch. An adverse, neutral, mixed, or inconclusive confirmation is appended
and retained before the candidate is rejected or deferred.

### Stage 3: Full Profile Or Causal Profiling

Escalate to the full six-phase profile when any of the following applies:

- the affected phase set cannot be justified narrowly;
- Stage 2 has a repeatable material signal and the candidate is being
  considered for adoption;
- another phase regresses, a scenario direction is mixed, or the materiality
  judgment is close to retained noise; or
- the decision needs the larger synthetic shapes used by P0 `full`.

Use built JavaScript rather than `ts-node` for causal profiling. Start CPU,
allocation, heap, GC, V8, or hardware-counter profiling only after Stage 2
shows a repeatable material signal and a causal question remains. A profile is
diagnostic evidence, not a substitute for the paired semantic benchmark.

## Efficiency Measures And Evidence Guardrails

The estimates below are relative timed-call reductions, not elapsed-time
guarantees. They are deliberately conditional because the P0 source did not
record a wall-clock duration.

| Proposed measure | Expected time benefit | Evidence risk | Guardrail | Condition that prevents hiding a negative, neutral, or inconclusive result |
| --- | --- | --- | --- | --- |
| Limit Stage 1/2 to the declared affected phase set, while retaining all seven scenarios. | One phase is 1/6 of a six-phase matrix: 1,344 rather than 8,064 calls per PR condition. | A shared change may affect an undeclared phase. | Declare the affected set before running; ambiguity expands the set to all six phases. | The screen verdict is phase-scoped only; uncertain or cross-phase effects escalate to the full matrix. |
| Use one alternating pair for Stage 1. | One pair is 1/3 of the three-pair confirmation call count. | A single pair is noise-sensitive. | Keep P0 PR sampling and every semantic sink; alternate conditions. | Stage 1 cannot accept an optimization or `no material effect`; every non-positive status is appended. |
| Keep P0 PR sampling instead of reducing samples or invocations. | Avoids designing and validating a new low-sample method; the saving comes from phase scoping and staged escalation. | It is tempting to report this as no change in cost. | State explicitly that samples, warmups, and invocations are unchanged. | No low-sample result can replace the retained P0-compatible evidence. |
| Stop immediately on a semantic mismatch. | Avoids spending the remaining pairs on a candidate already shown semantically invalid. | A mismatch might be treated as an inconvenient outlier. | Persist both artifacts, mismatch detail, and candidate status before stopping. | The terminal status is `semantic_mismatch`, never omitted or converted into a timing-only result. |
| Run `full` only after its explicit escalation conditions. | Avoids the 4.83x-per-condition P0 full-profile cost when a candidate has no usable Stage 2 signal. | Larger synthetic shapes or cross-phase regressions can be missed. | No adoption decision from a narrowly scoped confirmation when a full-profile condition applies. | Neutral, adverse, mixed, and borderline Stage 2 results are recorded and either rejected/deferred or escalated; they are not replaced by selected full rows. |
| Defer causal profiling until a repeatable material Stage 2 signal exists. | Avoids expensive profiler collection and analysis for candidates with no measurable decision signal. | A benchmark result could be overinterpreted as a root cause. | Use profiling only to answer a named causal question, with built JavaScript, after paired evidence. | A non-positive benchmark remains the recorded result; absence of a profile cannot erase or relabel it. |
| Append a candidate ledger entry that names every process artifact and every scenario status. | Reduces reviewer reconstruction and rerun time; no timed-call reduction is claimed. | Manual summaries can selectively omit rows. | Require a fixed outcome vocabulary and artifact list before a candidate is closed. | The entry is incomplete until it includes adverse, neutral, inconclusive, and skipped/escalated rows as applicable. |

## Candidate Record Requirements

Create one tracked append-only candidate record alongside the future benchmark
report. It must include the candidate and base commit, declared phase set,
environment, commands, alternating run order, raw artifact paths, all
scenario-level paired rows, sink result, status, escalation decision, and a
plain-language limitation. The allowed performance statuses are:

- `repeatable_signal`
- `adverse_signal`
- `neutral_or_inconclusive`
- `semantic_mismatch`
- `not_measured`

Do not use an aggregate workload mean to replace scenario rows. Do not call a
baseline-only run, an unconfirmed screen, or a profile a performance effect.

## Acceptance Matrix For This Investigation

| Acceptance item | Status | Repository evidence | Gap / limitation |
| --- | --- | --- | --- |
| Identify concrete P0 measurement-time and noise costs. | done | P0 source, P0 Markdown method/results, and accepted handoff report cited above; call counts and artifact sizes are derived from those inputs. | P0 did not emit wall-clock duration, so no seconds-saved claim is made. |
| Define cheap screen, confirmation, and escalation stages. | done | `Staged Decision Protocol` names each stage, permitted conclusion, and full/profile triggers. | The protocol is unimplemented and requires a separate, reviewed task before execution. |
| State benefit, risk, guardrail, and non-positive-result condition for each efficiency measure. | done | `Efficiency Measures And Evidence Guardrails` table. | Relative call counts are estimates, not runtime measurements. |
| Separate measurements from hypotheses and preserve non-positive outcomes. | done | `Evidence Provenance And Limits`, required invariants, stage statuses, and candidate-record requirements. | Future candidate entries must apply the protocol; none exists in this change. |

## Recommendation And Human Decision

Approve the protocol as the required pre-optimization decision process. The
next task, if approved, should implement no more than the run-recording and
paired candidate capability needed to execute it, then measure one separately
approved candidate. Do not infer approval for that implementation or candidate
from this investigation.
