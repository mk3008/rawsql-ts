# MCP Durable Value Evaluation — 2026-08

## Decision

**Status: done / integration-layer-prevents-benefits-from-materializing**

The current MCP functions demonstrate durable structural value when called
directly, but that value did not materialize in unprompted agent use on the
tested Codex host.

The direct capability control showed deterministic exhaustive search,
DDL-backed ownership, fail-closed query slicing, safe-only condition rewrites,
and conservative fixture planning. The natural-use condition made zero rawsql
MCP calls in all 18 MCP-available runs. A separate plan-only diagnosis also
rejected rawsql MCP for the four positive scenarios for the incorrect reason
that a SQL MCP implies a live database connection. In addition, the host could
not expose `slice_query` because it rejected part of the input schema.

Secondary tags:

- `tool-selection-and-discoverability`
- `host-schema-compatibility`
- `large-detail-result-context-cost`

This is not a decision to add, remove, rename, or redesign a tool. The current
[Product Gate decision](./mcp-product-decision-2026-08.md) remains in force.

An independent evaluator classified the capability evidence as
`done / conditional-mcp-value-demonstrated` with
`tool-discoverability-gap`. That evaluator agreed that product-level natural
use remains unproven and host integration blocks extraction. This report uses
the stricter product-facing primary decision above because the tested agent did
not realize the demonstrated capability value in any MCP-available run.

## Evaluation question

This evaluation tested whether the ten-tool catalog has durable value as an
externalized deterministic SQL analysis capability, independently from one
agent's prose quality. It asked:

1. Does the capability execute faster than an agent-driven native workflow?
2. Does it reduce token and context cost?
3. Is its output stable across repeated runs?
4. Does it have a measurable advantage in exhaustive search, DDL matching, and
   safe transformations?
5. If agents do not use it, is the cause capability insufficiency or selection
   and integration behavior?

No product source, tool schema, tool description, prompt guidance, or agent
rule was changed during this evaluation.

## Method

### Frozen evidence

- Base: `origin/main` at `d3db9fd4204306b8eb0b079f9b5bcc98268f953c`
- Model: `gpt-5.6-terra`, medium reasoning
- Host: `codex-cli 0.144.4`
- Repetitions: three for every scored condition
- Scenario specification SHA-256:
  `fff2d60b0a2f31ef88ec0004e5351ab3307b37f5eaae8cf94f78c429d1a3d1a9`
- Generated corpus: 2,485 files, 296,989 bytes

The participant workspaces excluded all ground-truth files. Run order alternated
between native-only and MCP-available conditions. Every natural run used a
fresh ephemeral session and read-only sandbox. Raw traces and generated
workspaces remain under ignored `tmp/` paths; this document retains only the
aggregated evidence needed to audit the decision.

### Layer separation

| Layer | Purpose | Runs |
| --- | --- | ---: |
| A: natural agent use | Native-only versus MCP available, without encouraging tool use | 36 |
| B: direct capability control | In-memory MCP client calls without LLM tool selection | 108 |
| C: tool-choice diagnosis | Plan-only explanation with no tool execution | 5 |

The natural extraction scenario was excluded after Stage 0 because
`analyze_query_structure` was callable but `slice_query` was omitted by the
host with:

```text
Skipping deferred MCP tool `mcp__rawsqlslice_query`: failed to build tool spec:
invalid type: map, expected a string
```

Layer B still evaluated the same extraction cases directly. This preserves the
distinction between host integration and MCP capability.

### Measurements

Natural runs recorded wall time, model token usage, reasoning tokens, shell and
grep calls, file-read calls, repeated retrieval, input SQL/DDL bytes, final
answer bytes, and MCP calls. Direct calls recorded tool latency, full SDK
`CallToolResult` bytes, JSON artifact text bytes, result hashes, catalog hashes,
and contract errors.

`CallToolResult` bytes include both `structuredContent` and the equivalent JSON
text response. Artifact text bytes measure only the JSON text payload. This
distinction matters because the transport response duplicates the artifact in
two representations.

## Results

### 1. End-to-end natural use

Across all six natural scenarios and three repetitions:

| Condition | Runs | Wall time | Input tokens | Output tokens | Reasoning tokens | Shell commands | rawsql calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Native-only | 18 | 14.2 min | 1,051,844 | 36,214 | 8,298 | 44 | 0 |
| MCP available | 18 | 14.4 min | 1,184,526 | 35,846 | 7,670 | 48 | 0 |

MCP availability did not improve end-to-end time or token cost because the
agent never selected a rawsql tool. It increased total input tokens by 12.6%
while producing no rawsql calls. The MCP-available sessions also emitted 84
repeated host warnings about the unusable `slice_query` schema.

This does not measure the cost of using a selected MCP result. It measures the
current host's natural behavior when the catalog is available.

### 2. Exhaustive semantic usage search

The corpus mixed real target uses in SELECT, WHERE, JOIN ON, GROUP BY, CTE, and
derived-table scopes with same-name columns on other tables, comments, string
literals, same-name CTE columns, and invalid SQL.

One direct `find_query_usage` call covered the complete workspace at every
scale:

| SQL files | True-positive files | Recall | Precision | Mean latency | Full result bytes |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 30 | 20 | 100% | 100% | 24.1 ms | 28,598 |
| 300 | 200 | 100% | 100% | 141.2 ms | 276,770 |
| 1,500 | 1,000 | 100% | 100% | 679.2 ms | 1,379,736 |

All three repetitions at each scale returned the same byte-for-byte response.

The 300-file natural runs also found the exact 200-file set in all six runs,
but took a mean 159.1 seconds in native-only sessions and 168.7 seconds when
MCP was available. They used 5.0 and 7.0 shell commands on average,
respectively. The result set was stable, while the prose and retrieval path
varied.

The direct capability is materially faster and mechanically complete. Its
detail result is not context-efficient: the 1,500-file response is about
1.35 MiB. Large exhaustive findings therefore demonstrate structural search
value and a separate presentation-cost constraint at the same time.

The prior observation of five sequential `find_query_usage` calls is not a
core requirement for the fixed target and workspace tested here: one direct
call was complete. Without the old trace, the exact motivation for those five
calls cannot be reconstructed. The current natural and plan-only evidence
points to progressive agent probing and tool-routing uncertainty rather than a
need in the search function itself.

### 3. DDL-backed column ownership

For four output columns in a CTE and join query, direct
`analyze_column_lineage` consistently identified:

| Output | Physical source | Query-result nullable | Reason |
| --- | --- | --- | --- |
| `order_id` | `g01.orders.order_id` | no | preserved input, primary key |
| `customer_id` | `g01.orders.customer_id` | no | preserved input, DDL `NOT NULL` |
| `account_status` | `g01.accounts.status` | yes | right side of `LEFT JOIN` |
| `ship_state` | `g01.shipments.ship_state` | yes | nullable column and right side of `LEFT JOIN` |

Scale results across all four targets and three repetitions:

| DDL tables | Calls | Mean latency | Mean bytes per target | Stable per target |
| ---: | ---: | ---: | ---: | --- |
| 10 | 12 | 23.4 ms | 80,974 | yes |
| 100 | 12 | 69.3 ms | 80,974 | yes |
| 500 | 12 | 299.1 ms | 80,974 | yes |

The extra DDL was irrelevant schema noise; ownership and outer-join
null-extension remained exact. This demonstrates deterministic mechanical DDL
matching and stable scaling.

The six natural answers were also semantically correct without MCP. Natural
mean time was 28.7 seconds versus 31.1 seconds with MCP merely available. Four
full lineage calls return about 324 KiB against 13.8 KiB of input SQL and DDL,
so full lineage is a context expansion rather than a context reduction in this
measured workflow.

### 4. Safe optional-condition transforms

Ten cases covered WHERE, CTE, INNER JOIN, GROUP BY, HAVING, UNION ALL,
DISTINCT, LIMIT/OFFSET, window expressions, and repeated parameters across
scopes. Thirty direct calls completed with no contract error at a mean 0.94 ms
and about 2.4 KiB per result. Every case was byte-stable across three runs, and
no unsafe rewrite was reported.

The direct transformer pruned recognized optional predicates in cases 1, 2, 4,
6, 9, and 10, and left cases 3, 5, 7, and 8 unchanged. The no-op cases do not
all carry an explicit skip diagnostic, which makes unsupported coverage harder
to distinguish from a deliberate no-op.

The initial scenario specification conservatively labeled window and repeated
cross-scope cases as blocked. That oracle was not valid for the supplied
contract: once a parameter is explicitly absent, each canonical
`(:parameter is null or predicate)` branch is true, so removing the whole
branch preserves semantics even when a window function exists or the same
absent parameter appears in multiple scopes. Those labels are not used as
correctness evidence. The durable finding is narrower: the transformer was
deterministic, applied only recognized safe-only rewrites, and left unsupported
shapes unchanged.

Natural answers repeated the conservative but invalid blocked labels for the
window and repeated-scope cases in all six runs. Because no rawsql tool was
called, this is an agent-reasoning result, not evidence against the transform.

### 5. Query extraction

Direct `analyze_query_structure` plus `slice_query` produced:

| Case | Result | Safety evidence |
| --- | --- | --- |
| Standalone derived query | `ready`, executable SQL | no outer reference |
| Backward CTE chain | `ready`, executable SQL | required `base` CTE included |
| Correlated EXISTS | `blocked`, no SQL | `SCOPE_CORRELATED` |
| Nested lateral/descendant reference | `blocked`, no SQL | `SCOPE_REFERENCE_UNRESOLVED` |

All 24 structure and slice calls were stable; mean direct latency was 1.35 ms.
This demonstrates fail-closed capability value. It does not demonstrate
natural-agent value on this host because `slice_query` could not be loaded.

### 6. Fixture extraction

The five-table scenario contained date, customer-status, and event-type
predicates but no physical foreign keys. Direct
`create_fixture_extraction_plan` returned the same `partial` result three times
in a mean 6.1 ms. It covered all five required relations, emitted one bounded
customer capture query, and refused to invent propagation for the other four
relations. The result explicitly reported ambiguous reproduction-key and
unbounded-capture reasons.

Four of six natural answers instead reported `done` and inferred a complete
logical capture/load plan from join columns despite the missing FK proof. The
remaining two reported `partial`, but treated missing runtime parameter values
as the blocker. The direct result is more conservative and better aligned with
the safety contract: it externalizes what is proven and what remains unproven.

This is the clearest durable safety-contract difference in the evaluation. It
does not establish that fixture extraction can produce a complete reproducer in
this scenario; the direct result correctly remained partial.

### 7. Negative controls

For `SELECT 1 AS constant`, all natural runs correctly used one file read and no
MCP. For the 74-byte named CTE, all natural runs also used one file read and
returned the correct standalone SQL without MCP. Making MCP available neither
improved the answer nor materially reduced time or tokens.

Direct validation and extraction were deterministic and sub-millisecond, but
the setup and result add no practical value to these trivial tasks. This
confirms that durable capability value is workload-dependent rather than a
reason to route every SQL request through MCP.

## Stability and reproducibility

- All 36 direct scenario groups had one response hash across three independent
  server instances: 108 calls, zero contract errors.
- Tool catalog hashes were identical across all direct calls.
- Natural semantic-search file sets were identical in all six runs.
- Natural DDL conclusions and both negative-control conclusions were
  semantically stable.
- Natural fixture status varied between `done` and `partial`, demonstrating
  that fluent manual reasoning did not provide the same fail-closed contract.
- Natural final text varied across repetitions even where the factual result
  was stable; direct MCP output was byte-stable.

## Why the agent did not use MCP

The evidence supports an integration and selection diagnosis rather than a
capability diagnosis:

1. Direct MCP calls succeeded and were deterministic on every tested family.
2. MCP-available natural runs made zero rawsql calls in 18 opportunities.
3. All five plan-only diagnoses chose familiar shell/file tools first.
4. For exhaustive search, DDL lineage, optional transforms, and fixture
   planning, the plan-only agent incorrectly described SQL MCP as a live-DB or
   execution-oriented facility and rejected it on that basis.
5. The host repeatedly failed to expose `slice_query`, showing a separate
   schema-compatibility barrier even when the capability itself works.

The negative-control rejection was appropriate. The other four rejections were
based on a false capability model. The primary obstacle is that the agent does
not discover or recognize these functions as local, static, file-backed SQL
capabilities before defaulting to shell and manual reasoning.

## Answers to the five questions

1. **Speed:** yes at the capability layer. Direct calls completed in
   sub-millisecond to sub-second time at the tested scales. No end-to-end speed
   benefit appeared because the natural agent did not call them.
2. **Token/context cost:** not demonstrated. MCP availability increased natural
   input tokens without use, and full/detail results expanded context
   substantially. The structural artifacts may reduce reasoning burden, but
   this evaluation did not observe that benefit in an actual selected-tool run.
3. **Stability:** clearly demonstrated for direct MCP output. All repeated
   direct results were byte-stable and contract-clean.
4. **Exhaustive search, DDL matching, safe transforms:** clearly demonstrated
   as deterministic capabilities. Exhaustive search achieved 100% recall and
   precision; DDL ownership stayed exact at 500 tables; extraction and fixture
   planning failed closed. Optional-condition coverage was narrower than the
   scenario set but did not perform an unsafe rewrite.
5. **Why tools are not used:** the observed blocker is agent routing,
   discoverability, and one host schema incompatibility, not lack of core
   function.

## Final judgment

**Integration layer is preventing benefits from materializing.**

The direct capability evidence is strong enough to reject “no durable value.”
It is not strong enough to claim that durable value is currently realized by
agents: the natural-use adoption rate was 0%, the enabled condition cost more
input context, and one key tool was unavailable on the host. The appropriate
maintenance-mode response is to retain the evidence and stop, not to begin a
new feature phase.

## Limits and stop condition

- The scale corpora are deterministic synthetic motifs, not heterogeneous real
  application repositories.
- Only one model and reasoning effort were used; no optional model substitution
  was needed to answer the primary question.
- Layer B measures capability execution, not LLM synthesis after a forced MCP
  call.
- Full/detail output was measured as-is; no prompt, view, or schema optimization
  was introduced after observing results.
- The original optional-condition oracle contained invalid conservative labels;
  these were disclosed and excluded from the correctness claim.
- No implementation or backlog item is authorized by this report. A future
  change still requires concrete evidence under the existing Product Gate
  maintenance rules.

The evaluation stops here.
