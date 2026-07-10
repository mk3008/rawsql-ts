# AST Analysis and Rendering Phase Benchmark

Status: measurement foundation. No product optimization is approved or implemented.

Base commit: `1a26e94ca8a839b73b4f5906139e3c515e50f18e`

## Decision

The repository now has direct, non-database measurements for one isolated analyzer collector, one integrated condition-optimization envelope, and four renderer boundaries. The first three independent PR-profile runs preserved every semantic sink.

These runs are not evidence of an optimization effect. Several sub-millisecond segments remain noisy, including one hot-format outlier after batching. The conclusion for every measured phase is therefore:

- absolute baseline: measured for this environment and corpus;
- stability: `noisy/inconclusive` for at least one scenario; and
- optimization effect: `not measured` because no candidate was compared.

Do not approve a product change from these absolute values. A future experiment must compare one candidate with the same corpus and sinks across alternating independent processes.

## Commands

Install the locked workspace dependencies when they are not already present:

```powershell
pnpm install --frozen-lockfile
```

Run the smallest meaningful profile in three independent Node.js processes:

```powershell
1..3 | ForEach-Object { pnpm benchmark:ast-phase:pr }
```

Run the larger synthetic profile separately when a PR result justifies more evidence:

```powershell
pnpm benchmark:ast-phase:full
```

Each process writes raw samples and metadata to:

```text
tmp/ast-analysis-phase-benchmark-<profile>-<timestamp>-pid<process-id>.json
```

## Phase Boundaries

No phase cost is derived by subtracting two envelopes.

| Phase | Direct timed boundary | Included | Excluded |
| --- | --- | --- | --- |
| `analyzer.select-output-collection` | `new SelectOutputCollector(resolver).collect(preParsedAst)` | collector construction, CTE/source resolution, wildcard expansion, ordered output metadata | parsing, projection, hashing, comparison |
| `analyzer.integrated-condition-optimization` | `optimizeConditions(preParsedOneShotAst, { cloneInput: false, ...scenarioOptions })` | safe-only condition pipeline and its compatibility SQL rendering | initial parsing, projection, hashing, comparison |
| `renderer.token-build` | reused `SqlPrintTokenParser.parse(preParsedOneShotAst)` | token construction and parameter collection | parsing, printing, projection, hashing, comparison |
| `renderer.print` | reused `SqlPrinter.print(prebuiltOneShotToken)` | token traversal and SQL string assembly | parsing, token construction, parameter collection, hashing, comparison |
| `renderer.hot-format` | reused `SqlFormatter.format(preParsedOneShotAst)` | token construction, parameter collection, printing, result assembly | parsing, formatter construction, hashing, comparison |
| `renderer.cold-format` | `new SqlFormatter(options).format(preParsedOneShotAst)` | formatter construction plus the complete format envelope | parsing, hashing, comparison |

The integrated condition boundary is intentionally not called a pure analyzer phase. Its current compatibility contract renders SQL internally. Its value must not be adjusted by subtracting renderer measurements.

## Corpus

The PR profile uses three tracked SQL assets and four deterministic synthetic inputs. The full profile keeps the shapes but expands the synthetic size from 32 to 128.

| Scenario | Source | PR bytes | Branch-relevant features |
| --- | --- | ---: | --- |
| `tracked.customer-summary` | tracked | 449 | joins, aggregate, distinct, group/order |
| `tracked.product-ranking` | tracked | 263 | left join, aggregate, coalesce, order |
| `tracked.sales-summary` | tracked | 239 | function, join, aggregate, group |
| `synthetic.cte-wildcard-duplicate` | synthetic | 869 | CTE chain, wildcard expansion, duplicate outputs, parameters |
| `synthetic.wide-output` | synthetic | 918 | 32 outputs, resolver, duplicate aliases |
| `synthetic.boolean-parameter-comment` | synthetic | 1,469 | AND/OR, parameters, comment, CASE, rejected one-line candidate |
| `synthetic.derived-union` | synthetic | 434 | derived table, UNION ALL, parameter placement |

Every warmup and measured invocation receives a distinct AST identity parsed before its timed sample. This is required because formatter traversal can update parameter indexes and consume comment state. Print measurements receive tokens that were also built before timing.

## Method

The PR profile uses:

- deterministic corpus seed `rawsql-ts-ast-phase-v1`;
- 4 warmup samples and 20 measured samples per scenario and phase;
- 8 one-shot invocations per sample, reported as milliseconds per invocation;
- `process.hrtime.bigint()` timing;
- nearest-rank p95, plus mean, standard deviation, minimum, maximum, and raw samples;
- a new AST object for every invocation; and
- retention of all 8 invocation results, followed by semantic projection, SHA-256 hashing, and exact sink comparison outside each timed sample batch.

The collector sink preserves output order, duplicate names, `outputIndex`, alias/source metadata, and formatted value SQL. The integrated condition sink preserves SQL, canonical SQL-and-parameter projections of `query` and `diagnostics.debugQuery`, phase summaries, applied/skipped items, warnings, errors, safety, and diagnostics. Pre-parsed inputs bind each parameter name to a deterministic name-derived value, so renderer sinks preserve parameter presence and order in addition to SQL length, SQL SHA-256, parameter count, parameter SHA-256, and a combined signature.

## Environment

The observations below ran in three independent processes:

```text
Node.js v22.14.0
pnpm 10.17.0
Windows_NT 10.0.26200, x64
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
ts-node source execution
base commit 1a26e94ca8a839b73b4f5906139e3c515e50f18e (dirty benchmark branch)
```

Process IDs and artifacts:

| Process | UTC timestamp | Artifact |
| ---: | --- | --- |
| 33872 | 2026-07-10T14:39:40.318Z | `tmp/ast-analysis-phase-benchmark-pr-2026-07-10T14-39-40.318Z-pid33872.json` |
| 28952 | 2026-07-10T14:39:48.051Z | `tmp/ast-analysis-phase-benchmark-pr-2026-07-10T14-39-48.051Z-pid28952.json` |
| 33480 | 2026-07-10T14:39:55.803Z | `tmp/ast-analysis-phase-benchmark-pr-2026-07-10T14-39-55.803Z-pid33480.json` |

## Observed Results

The tables report the minimum and maximum of the three process-level means and p95 values. `max CV` is the largest within-process standard-deviation/mean ratio. The ranges are observations, not confidence intervals and not a blended workload.

### Analyzer: select output collection

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.023324–0.033502 | 0.032063–0.044738 | 1.32 |
| `tracked.product-ranking` | 0.014158–0.016375 | 0.019100–0.019350 | 0.24 |
| `tracked.sales-summary` | 0.008475–0.012669 | 0.012963–0.014150 | 0.25 |
| `synthetic.cte-wildcard-duplicate` | 0.114670–0.139225 | 0.139850–0.166900 | 0.34 |
| `synthetic.wide-output` | 0.019689–0.023175 | 0.036500–0.047088 | 0.91 |
| `synthetic.boolean-parameter-comment` | 0.030130–0.039556 | 0.045138–0.055375 | 0.30 |
| `synthetic.derived-union` | 0.016950–0.021474 | 0.022213–0.025500 | 1.55 |

### Analyzer: integrated condition optimization

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.300428–0.340807 | 0.431200–0.448438 | 0.27 |
| `tracked.product-ranking` | 0.162169–0.187285 | 0.244875–0.250138 | 0.25 |
| `tracked.sales-summary` | 0.118582–0.130784 | 0.192525–0.218788 | 0.42 |
| `synthetic.cte-wildcard-duplicate` | 1.415948–1.474374 | 1.717450–1.921438 | 0.17 |
| `synthetic.wide-output` | 0.278035–0.368863 | 0.317525–0.527900 | 0.30 |
| `synthetic.boolean-parameter-comment` | 2.843974–2.919964 | 3.214300–3.364225 | 0.13 |
| `synthetic.derived-union` | 0.802959–0.814815 | 1.041738–1.152838 | 0.23 |

### Renderer: token build

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.030646–0.056005 | 0.047375–0.108688 | 0.60 |
| `tracked.product-ranking` | 0.022959–0.028912 | 0.034475–0.042638 | 0.81 |
| `tracked.sales-summary` | 0.018210–0.021597 | 0.027650–0.029538 | 0.38 |
| `synthetic.cte-wildcard-duplicate` | 0.066556–0.108508 | 0.078188–0.155663 | 0.34 |
| `synthetic.wide-output` | 0.041420–0.048324 | 0.060750–0.080325 | 0.35 |
| `synthetic.boolean-parameter-comment` | 0.112198–0.132109 | 0.155250–0.185275 | 0.25 |
| `synthetic.derived-union` | 0.036068–0.046725 | 0.055975–0.067013 | 0.55 |

### Renderer: print

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.036443–0.042440 | 0.046825–0.054113 | 0.89 |
| `tracked.product-ranking` | 0.017139–0.028118 | 0.021925–0.030550 | 1.16 |
| `tracked.sales-summary` | 0.019217–0.031796 | 0.024000–0.063700 | 1.27 |
| `synthetic.cte-wildcard-duplicate` | 0.088646–0.097425 | 0.118150–0.124313 | 0.41 |
| `synthetic.wide-output` | 0.036257–0.068124 | 0.037638–0.075663 | 0.61 |
| `synthetic.boolean-parameter-comment` | 0.153428–0.237758 | 0.197325–0.401450 | 0.41 |
| `synthetic.derived-union` | 0.045810–0.055735 | 0.069300–0.100488 | 0.49 |

### Renderer: hot format

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.058935–0.072657 | 0.087125–0.137050 | 0.52 |
| `tracked.product-ranking` | 0.045565–0.056111 | 0.065075–0.131600 | 0.61 |
| `tracked.sales-summary` | 0.030884–0.039446 | 0.048313–0.053875 | 0.68 |
| `synthetic.cte-wildcard-duplicate` | 0.152335–0.181646 | 0.173788–0.282675 | 0.30 |
| `synthetic.wide-output` | 0.084622–0.112275 | 0.151588–0.158400 | 0.41 |
| `synthetic.boolean-parameter-comment` | 0.229693–0.279100 | 0.270913–0.422388 | 0.25 |
| `synthetic.derived-union` | 0.071039–0.121273 | 0.095538–0.184650 | 0.30 |

### Renderer: cold format

| Scenario | Mean range (ms) | p95 range (ms) | max CV |
| --- | ---: | ---: | ---: |
| `tracked.customer-summary` | 0.091867–0.094325 | 0.123500–0.161313 | 0.41 |
| `tracked.product-ranking` | 0.049714–0.068906 | 0.075313–0.076888 | 0.57 |
| `tracked.sales-summary` | 0.038128–0.050768 | 0.066838–0.104650 | 0.71 |
| `synthetic.cte-wildcard-duplicate` | 0.161451–0.209691 | 0.187838–0.297825 | 0.28 |
| `synthetic.wide-output` | 0.084813–0.130465 | 0.108863–0.222250 | 0.40 |
| `synthetic.boolean-parameter-comment` | 0.232008–0.313494 | 0.270525–0.460450 | 0.28 |
| `synthetic.derived-union` | 0.073793–0.134520 | 0.102625–0.186563 | 0.25 |

## Semantic Sink Observations

All three processes produced identical sink signatures for every scenario and phase. Collector results included the expected duplicate-preserving outputs:

| Scenario | Outputs | Duplicate names | Sink prefix |
| --- | ---: | ---: | --- |
| `tracked.customer-summary` | 6 | 0 | `36d0c282f0f6` |
| `tracked.product-ranking` | 3 | 0 | `bf1a44c9c62f` |
| `tracked.sales-summary` | 2 | 0 | `501971b2262d` |
| `synthetic.cte-wildcard-duplicate` | 14 | 1 | `de9dfb2ec118` |
| `synthetic.wide-output` | 32 | 2 | `e97ef2a9c9fc` |
| `synthetic.boolean-parameter-comment` | 2 | 0 | `9b06db03fbe5` |
| `synthetic.derived-union` | 2 | 0 | `cddfdf62d66b` |

The integrated condition results were all `ok` with zero errors. The CTE scenario applied 2 changes, the boolean/comment scenario applied 1 and retained 33 explicit skips, and the derived UNION scenario applied 1. Those counts and their SQL/diagnostic hashes were stable across processes.

## Per-Phase Conclusions

| Phase | Absolute result | Stability conclusion | Optimization-effect conclusion |
| --- | --- | --- | --- |
| `analyzer.select-output-collection` | measured | `noisy/inconclusive` in small/wide segments | `not measured` |
| `analyzer.integrated-condition-optimization` | measured integrated envelope | `noisy/inconclusive` for derived UNION and some tails | `not measured` |
| `renderer.token-build` | measured direct boundary | `noisy/inconclusive` in several sub-ms segments | `not measured` |
| `renderer.print` | measured direct boundary | `noisy/inconclusive` in several sub-ms segments | `not measured` |
| `renderer.hot-format` | measured reused-formatter envelope | `noisy/inconclusive` in several segments and tails | `not measured` |
| `renderer.cold-format` | measured construction-plus-format envelope | `noisy/inconclusive` in several tails | `not measured` |

No phase supports `effect` or `no material effect` because this foundation compares no candidate. A future candidate may be classified that way only after paired multi-process evidence exceeds the retained noise.

## Limitations and Not-Measured Work

- Parser cost is excluded by construction and was not measured here.
- Formatter-constructor-only cost was not measured. Cold minus hot must not be reported as constructor cost.
- Internal condition subphase costs were not measured independently.
- Allocation, heap, GC, CPU profiles, V8 optimization traces, and hardware counters were not measured.
- The scenario matrix is branch-diverse but does not claim production frequency or a blended distribution.
- PR samples still include JIT, GC, scheduler, timer, and `ts-node` sensitivity. Use built JavaScript for causal profiling.
- One local OS/CPU/Node combination is not portable performance evidence.
- The full profile was not run for this P0 verification; the three-process PR profile is the smallest meaningful required evidence.
- Negative, neutral, or inconclusive future candidate results must be appended here rather than discarded.

## Future Candidate Protocol

1. Change one candidate only.
2. Keep the same corpus seed, scenario definitions, formatter options, object-identity policy, and sinks.
3. Alternate baseline and candidate processes instead of running all baselines first.
4. Retain raw process artifacts and report every scenario independently.
5. Reject the candidate when its effect does not exceed run-to-run noise or any semantic sink changes.
6. Profile only after a material phase is repeatable.
