# Rejected AST Analysis and Rendering Candidate Findings

This document records performance candidates that were implemented and measured
under the paired AST benchmark protocol but were not adopted. It prevents a
future change from treating a superficially removed allocation, copy, or
traversal as an unmeasured optimization opportunity.

These findings apply only to the recorded candidate, phase scope, P0 corpus,
and measurement environment. They do not prove that every related redesign is
unhelpful. A new proposal must have a distinct mechanism, predeclare its scope
and thresholds, and retain new paired evidence rather than reusing these
results as a speed claim.

## R3: nested SelectOutputCollector output-index projection

- Candidate ID: `select-output-internal-raw-collection-r3`
- Candidate commit: `71c5e83f49ecc67a44708145b4cea34ee1028beb`
- Proposed mechanism: bypass the public `outputIndex` projection inside nested
  SELECT and CTE recursion, then retain the single public projection boundary.
- Declared phases: `analyzer.select-output-collection` and
  `analyzer.integrated-condition-optimization`.
- Semantic result: all Stage 1, Stage 2, and full-profile semantic sinks
  matched.
- Performance result: Stage 2 was `adverse_signal` because
  `analyzer.integrated-condition-optimization / synthetic.derived-union` was
  adverse. Neither predeclared primary CTE row was repeatably favorable. The
  full profile was `neutral_or_inconclusive`.
- Decision: rejected. Do not adopt this exact private raw-route change as a
  performance optimization.

## R4: lazy SelectOutputCollector CTECollector construction

- Candidate ID: `select-output-lazy-cte-collector`
- Candidate commit: `1f7f5dfdbf7a5e06b9878ccdecaeb0f8ab0177fa`
- Proposed mechanism: do not construct the private `CTECollector` when a
  non-empty inherited common-table context makes CTE discovery unnecessary.
- Declared phases: `analyzer.select-output-collection` and
  `analyzer.integrated-condition-optimization`.
- Semantic result: all Stage 1, Stage 2, and full-profile semantic sinks
  matched; focused CTE visibility and collector-reuse tests passed.
- Performance result: Stage 2 was `adverse_signal` for
  `analyzer.integrated-condition-optimization / synthetic.boolean-parameter-comment`
  and `analyzer.integrated-condition-optimization / synthetic.derived-union`.
  The full profile was `neutral_or_inconclusive`.
- Decision: rejected. Do not adopt lazy construction alone as a performance
  optimization.

## R5: deferred SqlPrinter state replaced by first print

- Candidate ID: `renderer-defer-replaced-print-state`
- Candidate commit: `7a8f07dc52fb4782839d269510748af39a0a8e94`
- Proposed mechanism: defer the constructor allocation of `LinePrinter` and
  the fallback `WeakSet`, both of which `print()` replaces before first use.
- Declared phases: `renderer.print`, `renderer.hot-format`, and
  `renderer.cold-format`.
- Semantic result: completed Stage 1/2 semantic sinks matched; the
  source-identical full profile matched 42 of 42 sinks.
- Performance result: the exact candidate's Stage 2 was `adverse_signal` for
  `renderer.hot-format / tracked.product-ranking` and
  `renderer.cold-format / synthetic.boolean-parameter-comment`. The
  source-identical full profile was `neutral_or_inconclusive`.
- Decision: rejected. Do not adopt deferred first-print state alone as a
  performance optimization.

## Reconsideration rule

Reconsider one of these areas only when the proposed change has a materially
different mechanism or a broader design goal than the rejected candidate. The
new task must:

1. link to this document and explain the difference;
2. preserve the relevant semantic sinks and regression contracts;
3. predeclare the benchmark phase scope and thresholds before timing; and
4. append every favorable, neutral, adverse, and semantic-mismatch result to
   `ast-analysis-benchmark-candidate-records.jsonl`.
