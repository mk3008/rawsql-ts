# MCP Explicit-Use Value Evaluation — 2026-08

## Decision

**Status: done / explicit-use-value-conditional**

Explicit routing to rawsql-ts MCP is worthwhile for tested work that needs an
exhaustive cross-file result or a deterministic fail-closed boundary. It is not
a useful default for every SQL task.

The clearest end-to-end gain was semantic usage search. Across the tested 30,
300, and 1,500-file corpora, both conditions found the exact file set, while the
MCP condition reduced mean wall time by 28%, 38%, and 46% and input tokens by
30%, 60%, and 61%. Fixture planning exposed a different value: MCP consistently
kept missing foreign-key propagation unproven, while native answers sometimes
invented fixture values or a complete plan. Safe extraction gave the same
correct ready/blocked conclusions in both conditions, but MCP grounded the
blocked cases in a reproducible fail-closed result.

The counter-evidence matters. DDL ownership was correct without MCP at every
tested scale; repeated full-lineage calls made the MCP condition about twice as
slow and much larger in context. Both negative controls were slower and more
token-intensive with explicit MCP use. Optional-condition rewriting was stable
and safe but incomplete on some supported-safe cases. Across all 66 scored runs,
the MCP condition used slightly less wall time but more input tokens overall.

This result does not change the current ten-tool Product Gate decision, restart
Phase 4C, or demonstrate natural discoverability. It answers the narrower
question: when a user or policy already knows that deterministic SQL computation
is needed, explicit tool routing has workload-specific value.

## Evaluation question

The experiment compared only:

- **A — Native:** rawsql-ts MCP unavailable; the agent used file reads, shell,
  search, and direct reasoning.
- **B — Explicit MCP:** rawsql-ts MCP available with one fixed instruction that
  required the directly applicable rawsql tool to be used as evidence.

Prompt wording was not optimized. Tool-selection recall and natural
discoverability were out of scope. An MCP-available run that ignored all rawsql
tools would have been an integration failure; none did.

## Method

### Frozen protocol

- Base: `origin/main` at
  `bd4b5151e8ac6fb8339d3970362a228951df1cdb`
- Model: `gpt-5.6-terra`, medium reasoning
- Host: `codex-cli 0.144.4`
- Session: fresh `codex exec --ephemeral`, read-only sandbox
- Repetitions: three per condition and scenario
- Scored runs: 66; execution failures: 0; integration failures: 0
- Original protocol SHA-256:
  `7a0b402bf42b3ca0b360e89a0f0c9600cc9b030cabcc4780e88195a32adaa401`
- Original participant manifest SHA-256:
  `b14145b601d02a2d2e8a9a46fe08e113a11139f4c139e5d57cd4851a5036f0b3`
- Selector-free extraction protocol SHA-256:
  `6bfad7170305ba5c61288b4c0e25962544d8c524b8b238f259204c5d2ac6f21f`
- Selector-free extraction participant manifest SHA-256:
  `150a0e0caa079dd6a0624d5a457235dc05755d082151fe525d07e8d14748c2e3`

Run order alternated A/B, B/A, A/B. Each condition received the same scenario
input without seeing the other condition's answer. The fixed B instruction was:

> この調査では rawsql-ts MCP を使用してください。
> 対象を直接カバーするrawsql-ts toolがある場合は、
> 手動のSQL解析やgrepだけで代替せず、そのtoolの結果を調査根拠として利用してください。
> 必要のないrawsql-ts toolまで呼ぶ必要はありません。

### Stage 0 and extraction correction

Stage 0 first produced cancelled MCP calls. The prompt was not changed. Before
freezing the scored protocol, the host was configured with its documented MCP
tool approval mode, after which `analyze_query_structure` and `slice_query`
both completed.

The first completed extraction A/B set was later found invalid for the required
workflow: public `cases.json` accidentally included selectors. Those six runs
remain in ignored raw evidence but are excluded from every score and aggregate.
A selector-free participant was frozen and six replacement runs were executed
with the same prompt, model, and host policy. A separate one-second wrapper
attempt left an aborted partial directory; it was retained and never scored.
The final scored aggregate records all exclusions and contains 66 unique runs.

### Measurements

Every run recorded wall time, model input/output/reasoning tokens, shell calls,
file-read command count, and final answer bytes. B runs also recorded the rawsql
call sequence, rawsql result bytes, and actual MCP request/response latency
through a transparent stdio proxy. The file-read metric counts commands that
read files, not OS-level read operations. Token counts are the cost proxy because
monetary cost was not available.

`MCP payload bytes` measure the complete JSON-RPC call results. `Tool result
bytes` measure the returned result content. Result consumption is reported as
`final answer bytes / tool result bytes`, an upper bound: not every final byte
came from the result, so the actual necessary share can only be lower.

## Aggregate operational result

| Condition | Runs | Wall time | Input tokens | Output tokens | Reasoning tokens | Shell calls | rawsql calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native | 33 | 25.8 min | 3,532,663 | 59,929 | 20,411 | 146 | 0 |
| Explicit MCP | 33 | 25.1 min | 4,102,312 | 58,782 | 16,921 | 61 | 231 |

The total does not support a general faster-or-cheaper claim. MCP engine work
was only 9.69 seconds of 25.1 minutes of B wall time. The remaining time was
agent orchestration, model inference, file reads, and result consumption. The B
runs received 13.0 MiB of MCP payload while producing 68.9 KiB of final answers.
That aggregate is dominated by unnecessary repeated search and full-lineage
calls, not by engine latency.

### Explicit-call efficiency

The independent evaluator classified 106 of 231 rawsql calls as necessary for
the requested evidence and 125 as redundant; 96 were repeated-confirmation
calls. This classification is task-specific: for example, four independent SQL
cases require four structure and four slice calls, while one complete
workspace-wide usage search does not require per-directory confirmation.

| Family | Calls | Necessary | Redundant | Repeated confirmation |
| --- | ---: | ---: | ---: | ---: |
| Semantic grep | 76 | 9 | 67 | 64 |
| DDL ownership | 85 | 36 | 49 | 32 |
| Optional transformation | 30 | 30 | 0 | 0 |
| Safe extraction | 24 | 24 | 0 | 0 |
| Fixture planning | 7 | 4 | 3 | 0 |
| Negative controls | 9 | 3 | 6 | 0 |

The fixed explicit instruction successfully caused applicable tool use, but it
did not teach optimal call count. Explicit routing and efficient result use are
separate integration concerns.

## Workload results

### 1. Semantic usage search

All six conditions at all scales had 100% recall and precision against the
frozen ground truth. One native 1,500-file final answer nevertheless reported
1,050 affected files while its own exact path expansion contained 1,000; this
was a presentation/count correctness defect, not a retrieval miss.

| SQL files | Condition | Mean wall | Wall SD | Mean input tokens | Mean rawsql calls | Engine time | MCP payload | Final/result upper bound |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | Native | 46.7 s | 4.1 s | 79,367 | 0 | — | — | — |
| 30 | MCP | 33.7 s | 1.4 s | 55,904 | 1.0 | 39 ms | 27.9 KiB | 10.1% |
| 300 | Native | 108.3 s | 21.3 s | 233,309 | 0 | — | — | — |
| 300 | MCP | 67.2 s | 15.0 s | 93,477 | 5.0 | 204 ms | 461 KiB | 1.2% |
| 1,500 | Native | 113.6 s | 5.7 s | 343,228 | 0 | — | — | — |
| 1,500 | MCP | 61.6 s | 8.6 s | 132,399 | 19.3 | 1,012 ms | 2.82 MiB | 0.1% |

The tested benefit appeared already at 30 files, but that is not a universal
30-file threshold. The corpus was deliberately rich in same-name decoys and
clause variants. The supportable guidance is to prefer MCP when a cross-file
answer must be exhaustive and semantically filtered, especially as the corpus
grows.

Call efficiency was poor above 30 files. The 300-file repetitions used 2, 11,
and 2 calls. The 1,500-file repetitions used 52, 2, and 4 calls. A single
workspace-wide call already contained the complete result. Per-directory
confirmation, identical full searches, and display-only refinements accounted
for most extra payload. This is agent orchestration overhead, not an engine
requirement.

### 2. DDL-backed ownership and nullability

Both conditions correctly mapped all four outputs at 10, 100, and 500-table
scales, including the nullable right side of the `LEFT JOIN`. Neither condition
was confused by same-name columns in irrelevant DDL.

| DDL tables | Condition | Mean wall | Mean input tokens | DDL read bytes | Mean rawsql calls | Engine time | MCP payload | Final/result upper bound |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | Native | 24.7 s | 43,035 | 1,958 | 0 | — | — | — |
| 10 | MCP | 58.5 s | 199,423 | 2,099 | 10.7 | 343 ms | 371 KiB | 0.3% |
| 100 | Native | 28.5 s | 61,283 | 8,579 | 0 | — | — | — |
| 100 | MCP | 54.0 s | 188,488 | 10,005 | 8.0 | 594 ms | 251 KiB | 1.2% |
| 500 | Native | 30.5 s | 89,790 | 45,393 | 0 | — | — | — |
| 500 | MCP | 58.8 s | 248,856 | 43,586 | 9.7 | 820 ms | 360 KiB | 0.3% |

The engine scaled below one second, but the end-to-end B workflow regressed.
Agents commonly called full lineage separately per output and sometimes called
compact only after full. One run repeated four identical lineage calls. The
final answer used at most 0.3–1.2% of returned detail. Compact-first guidance is
therefore useful, but the result does not justify changing schemas in this task.

The DDL file-read byte proxies were similar between conditions and rose with
scale. Context expansion came primarily from tool results and repeated calls,
not from the few additional DDL bytes read by the agent.

### 3. Safe optional-condition transformation

No run made an unsafe rewrite. MCP produced the same generated SQL decisions in
all repetitions and used one call per case. Native conservatively missed safe
rewrites in cases 05, 09, and 10; MCP missed safe rewrites in cases 03 and 05.
Both were incomplete rather than unsafe.

| Condition | Mean wall | Mean input tokens | Reasoning tokens | Calls | Engine time | Payload | Final/result upper bound |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native | 48.2 s | 90,758 | 703 | 0 | — | — | — |
| MCP | 46.6 s | 98,527 | 316 | 10 | 50 ms | 24.0 KiB | 12.6% |

The MCP condition reduced reasoning and stabilized generated SQL, but did not
reduce input context and did not cover every safe canonical branch. This is a
conditional recommendation for supported shapes, not proof of a complete
optional-condition optimizer.

### 4. Safe query extraction

The selector-free replacement produced the same correct outcomes in every run:
standalone derived and backward CTE scopes were ready; correlated `EXISTS` and
nested/lateral scopes were blocked without SQL. Each B run made one structure
call and one slice call per case: eight non-redundant calls total.

| Condition | Mean wall | Wall SD | Mean input tokens | Reasoning tokens | Calls | Engine time | Payload | Final/result upper bound |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native | 49.8 s | 5.4 s | 117,921 | 698 | 0 | — | — | — |
| MCP | 43.1 s | 1.4 s | 113,699 | 425 | 8 | 82 ms | 24.1 KiB | 5.1% |

Native reconstruction was also correct, so this is not a claim that an LLM
cannot recognize correlation. MCP's distinct value is a reusable selector and
a contract that returns no candidate SQL when the boundary is not proven.

### 5. Fixture planning

The DDL intentionally omitted physical foreign keys. MCP consistently returned
a partial plan, retained all five relations, and left unsupported propagation
unproven. Native answers varied in their calibration and sometimes introduced
specific fixture values, expected rows, or a complete capture/load conclusion
that the supplied evidence did not prove.

| Condition | Mean wall | Mean input tokens | Reasoning tokens | Calls | Engine time | Payload | Final/result upper bound |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native | 46.9 s | 63,117 | 619 | 0 | — | — | — |
| MCP | 47.3 s | 105,070 | 332 | 2.3 | 62 ms | 28.4 KiB | 13.4% |

There was no speed or token win. The recommendation is based on safety and
confidence calibration: explicit MCP use reduced unsupported completion of the
plan. Calls beyond `create_fixture_extraction_plan` in the first two
repetitions were not needed for the requested conclusion.

### 6. Negative controls

| Scenario | Condition | Mean wall | Mean input tokens | Calls | Engine time |
| --- | --- | ---: | ---: | ---: | ---: |
| Simple SQL | Native | 9.3 s | 27,857 | 0 | — |
| Simple SQL | MCP | 15.9 s | 65,607 | 2 | 12 ms |
| Tiny known CTE | Native | 10.2 s | 27,889 | 0 | — |
| Tiny known CTE | MCP | 15.8 s | 65,988 | 1 | 13 ms |

The simple SQL answer did not improve, and its second MCP call was unnecessary.
For the tiny CTE, MCP returned the exact requested standalone body more
consistently, but the task was easy to correct manually and the catalog/context
overhead dominated. Neither is a general recommendation.

## Operational metric appendix

The tables above emphasize the decision-driving measures. This appendix keeps
the remaining per-workload means visible. `Reads` is the file-read command
proxy described in the method, not an OS read count.

| Scenario | Condition | Input tokens | Output tokens | Reasoning tokens | Shell | Reads |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Semantic 30 | Native | 79,367 | 1,860 | 480 | 4.0 | 4.0 |
| Semantic 30 | MCP | 55,904 | 1,298 | 320 | 0.0 | 0.0 |
| Semantic 300 | Native | 233,309 | 4,731 | 1,188 | 9.3 | 7.3 |
| Semantic 300 | MCP | 93,477 | 3,172 | 934 | 0.0 | 0.0 |
| Semantic 1,500 | Native | 343,228 | 4,852 | 2,276 | 9.7 | 8.7 |
| Semantic 1,500 | MCP | 132,399 | 2,738 | 1,427 | 0.3 | 0.3 |
| DDL 10 | Native | 43,035 | 765 | 205 | 2.0 | 2.0 |
| DDL 10 | MCP | 199,423 | 2,199 | 586 | 3.7 | 3.7 |
| DDL 100 | Native | 61,283 | 960 | 288 | 3.0 | 3.0 |
| DDL 100 | MCP | 188,488 | 1,917 | 494 | 3.7 | 3.7 |
| DDL 500 | Native | 89,790 | 993 | 314 | 3.3 | 3.3 |
| DDL 500 | MCP | 248,856 | 2,295 | 716 | 4.0 | 4.0 |
| Optional conditions | Native | 90,758 | 1,930 | 703 | 5.0 | 4.0 |
| Optional conditions | MCP | 98,527 | 1,890 | 316 | 2.0 | 2.0 |
| Safe extraction | Native | 117,921 | 1,631 | 698 | 7.0 | 6.7 |
| Safe extraction | MCP | 113,699 | 1,610 | 425 | 2.0 | 2.0 |
| Fixture planning | Native | 63,117 | 1,912 | 619 | 3.3 | 3.0 |
| Fixture planning | MCP | 105,070 | 1,873 | 332 | 2.7 | 2.3 |
| Simple SQL | Native | 27,857 | 149 | 17 | 1.0 | 1.0 |
| Simple SQL | MCP | 65,607 | 292 | 44 | 1.0 | 1.0 |
| Tiny known CTE | Native | 27,889 | 193 | 15 | 1.0 | 1.0 |
| Tiny known CTE | MCP | 65,988 | 310 | 45 | 1.0 | 1.0 |

MCP result and final-answer sizes show where returned detail exceeded what the
answer could consume:

| Scenario | Calls | Tool result | Final answer | Final/result upper bound |
| --- | ---: | ---: | ---: | ---: |
| Semantic 30 | 1.0 | 27.9 KiB | 2.8 KiB | 10.1% |
| Semantic 300 | 5.0 | 460.9 KiB | 6.0 KiB | 1.2% |
| Semantic 1,500 | 19.3 | 2.71 MiB | 2.4 KiB | 0.1% |
| DDL 10 | 10.7 | 370.1 KiB | 1.2 KiB | 0.3% |
| DDL 100 | 8.0 | 250.8 KiB | 1.2 KiB | 1.2% |
| DDL 500 | 9.7 | 359.4 KiB | 1.2 KiB | 0.3% |
| Optional conditions | 10.0 | 23.7 KiB | 3.0 KiB | 12.6% |
| Safe extraction | 8.0 | 23.8 KiB | 1.2 KiB | 5.1% |
| Fixture planning | 2.3 | 28.3 KiB | 3.7 KiB | 13.4% |
| Simple SQL | 2.0 | 1.0 KiB | 0.1 KiB | 10.4% |
| Tiny known CTE | 1.0 | 0.4 KiB | 0.2 KiB | 40.3% |

## Independent quality scoring

An independent evaluator scored every final answer from 0–4 for correctness,
evidence grounding, completeness, actionability, and confidence calibration.
The run-level scores and reasons were checked against the frozen ground truth;
the aggregate below is the mean total out of 20.

| Scenario | Native mean | MCP mean | Delta |
| --- | ---: | ---: | ---: |
| Semantic grep — 30 files | 20.00 | 20.00 | 0.00 |
| Semantic grep — 300 files | 20.00 | 20.00 | 0.00 |
| Semantic grep — 1,500 files | 19.00 | 20.00 | +1.00 |
| DDL ownership — 10 tables | 20.00 | 20.00 | 0.00 |
| DDL ownership — 100 tables | 20.00 | 20.00 | 0.00 |
| DDL ownership — 500 tables | 20.00 | 20.00 | 0.00 |
| Optional conditions | 14.00 | 16.00 | +2.00 |
| Safe extraction | 20.00 | 20.00 | 0.00 |
| Fixture planning | 12.67 | 17.67 | +5.00 |
| Simple SQL control | 20.00 | 20.00 | 0.00 |
| Tiny known CTE control | 12.00 | 20.00 | +8.00 |
| **All runs** | **17.97** | **19.42** | **+1.45** |

The tiny CTE quality delta does not make it a recommended default. Native
answers explained the CTE but returned the wrapper instead of the requested
minimal standalone body; MCP fixed that bounded output defect at the cost of a
56% wall-time increase and more than twice the input tokens. Recommendation
classification combines quality with operational overhead.

Final prose hashes varied in every nontrivial scenario even where conclusions
were stable. Mechanical semantic result sets, generated transform decisions,
and extraction statuses were stable. The fixture status and unsupported claims
varied most in native answers. Stability should therefore be interpreted at the
fact/decision level, not as byte-identical agent prose.

Quality was identical across repetitions for every scenario except native
1,500-file search (20, 20, 17), native fixture planning (18, 10, 10), and MCP
fixture planning (18, 18, 17). The largest stability difference was therefore
confidence calibration under missing relationship evidence, not ordinary SQL
ownership or scope classification.

## Recommendation matrix

| Workload | Classification | Why | Main limitation |
| --- | --- | --- | --- |
| Semantic usage search | Conditional | Exact exhaustive results with lower tested wall time and tokens | Call efficiency varied from one complete call to 52 calls and large unused payloads |
| DDL ownership/nullability | No recommendation for the tested task; conditional only when mechanical evidence is a separate requirement | Deterministic schema and join grounding | Native was already correct; full-lineage orchestration was slower and context-heavy |
| Optional-condition transform | Conditional | Safe-only, stable generated SQL on supported forms | Some safe canonical forms remained unchanged |
| Safe query extraction | Strong when fail-closed behavior matters | Correct ready/blocked decisions with no SQL on unproven boundaries | Native also solved these four cases; benefit is contract and reproducibility |
| Fixture planning | Conditional | Kept missing-FK propagation partial and explicit | More tokens; partial output still requires human facts |
| Simple SQL explanation | No recommendation | Native answer was sufficient | MCP added latency and context |
| Tiny known CTE | No recommendation | Direct reading is cheap and the CTE name is already known | MCP's cleaner extraction did not justify setup overhead here |

## README gap analysis and update

The pre-evaluation README already contained the ten-tool catalog, arguments,
suggested workflows, boundaries, and output contracts. It did not answer:

- why to use a deterministic MCP when an LLM can already read SQL;
- which workloads justify explicit routing;
- when not to use MCP;
- how exhaustive, fail-closed, and context-cost evidence changes that choice.

The accompanying README update adds a short use-case table and negative
guidance, then links here for evidence. It deliberately avoids exact benchmark
thresholds and universal claims.

## Engineering journal update

The durable journal should add this experiment as a new observation rather
than revise earlier natural-use failures into a success story. The useful arc is:

1. Natural availability still did not cause selection.
2. A fixed explicit policy made every B run use the applicable tool.
3. Explicit use created clear value for exhaustive search and fail-closed
   safety, but regressed DDL and trivial workflows through context and repeated
   calls.
4. The first extraction harness leaked selectors and had to be invalidated and
   rerun, demonstrating that evaluation design itself needs evidence review.
5. The resulting product interpretation is conditional routing, not a new tool,
   Phase 4C, schema redesign, or renewed discoverability tuning.

## Product interpretation

rawsql-ts MCP is not established as a tool that an agent will select merely
because it is installed. It is established, on these tested workloads, as a
tool worth explicitly requiring when the task needs exhaustive semantic search,
reproducible fail-closed extraction, or conservative handling of unproven
fixture relations.

It should not be required for simple explanations, tiny known CTEs, or every
DDL-backed query. Explicit routing must name a reason: exhaustive coverage,
mechanical schema evidence, deterministic transformation, or a safety boundary.
Without one of those reasons, the catalog and payload overhead can exceed the
value of the result.

## Scope and stop decision

- No product source, MCP schema, tool description, or output shape changed.
- No discoverability prompt tuning was performed.
- No new tool, tool rename, consolidation, or Phase 4C work follows from this
  evaluation.
- Result-schema optimization and compact-view changes remain separate evidence-
  driven questions; this report only records observed payload cost.
- The Product Gate remains `done / current-10-tools-sufficient`.
