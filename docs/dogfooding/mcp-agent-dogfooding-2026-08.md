# MCP Agent Dogfooding — 2026-08

## Judgment

Status: `blocked / mcp-practical-value-not-demonstrated`

This black-box run did not demonstrate that making the rawsql-ts MCP server
available materially improves an AI agent's SQL-investigation answers. The
result does not overturn the existing `current-10-tools-sufficient` catalog
decision: catalog sufficiency and autonomous agent utilization are different
claims. No tool, schema, source, or Phase 4C change was made from this evidence.

## Method

- Repository base: `d3db9fd4204306b8eb0b079f9b5bcc98268f953c`
- Agent: Codex CLI `0.144.4`, `gpt-5.6-terra`, medium reasoning
- MCP host and transport: Codex CLI with the local stdio server
- Scenarios: 10 realistic SQL-investigation requests
- Runs: 10 A runs without rawsql MCP and 10 B runs with rawsql MCP
- Context: a fresh ephemeral process for every condition
- Execution: read-only scenario workspaces, no database connection or SQL execution
- Blindness: scenarios and ground truth were frozen before execution; answer
  quality was scored with A/B identity and tool traces hidden, followed by a
  separate trace-aware tool-utility pass

The scenario packet SHA-256 was
`159c3f5c49806877285770f1082808b3093fe7ff8482f1fb3bc968f5e15e8528`
before and after all runs. All 20 runs completed with distinct thread IDs and
exit code 0.

## Results

| Scenario | A score | B blind score | B trace-aware score | Rawsql calls | Comparison |
| --- | ---: | ---: | ---: | ---: | --- |
| Wrong aggregate | 19 | 20 | 20 | 0 | Neutral |
| Deeply nested query | 16 | 16 | 16 | 0 | Neutral |
| Correlated `EXISTS` safety | 18 | 17 | 17 | 0 | Neutral |
| Known CTE extraction | 20 | 19 | 19 | 0 | MCP somewhat worse |
| Cross-file impact search | 20 | 12 | 19 | 5 | MCP somewhat worse |
| Fixture extraction | 16 | 19 | 19 | 0 | Neutral |
| Query contract review | 20 | 20 | 20 | 0 | Neutral |
| Optional condition optimization | 20 | 18 | 18 | 0 | Neutral |
| Simple query, no tool needed | 20 | 20 | 20 | 0 | Neutral |
| Ambiguous request | 10 | 11 | 11 | 0 | Neutral |

Primary blind answer scores averaged 17.9/20 for A and 17.2/20 for B. The
single trace-aware correction raised B to 17.9/20: the cross-file answer's AST
scan claims were directly supported by hidden MCP trace evidence. This produced
parity, not attributable improvement.

The B runs averaged 26.6 seconds versus 22.8 seconds for A. The MCP utility
score averaged 11.5/16. There were no scenarios classified as clearly or
somewhat better with MCP, eight neutral scenarios, and two somewhat worse
scenarios. The host recorded 6 MCP-host calls in total: 5 rawsql calls and 1
unrelated built-in call. Two calls were unnecessary (one redundant and one
harmful/noisy), and no MCP call failed. Seven B-side shell commands were
declined separately by the read-only host policy.

## Tool behavior

The agent used rawsql-ts in only 1 of the 8 scenarios whose frozen ground truth
marked MCP evidence as useful. The only exercised rawsql workflow was
cross-file impact search:

- 5 `find_query_usage` calls;
- 1 necessary call;
- 3 useful-but-optional calls;
- 1 redundant call;
- 0 failed rawsql calls.

One additional built-in `list_mcp_resources` call was harmful/noisy and unused.
Across all MCP-host calls, 4 results contributed to the final answer and 2 did
not. The impact-search B run took 58.6 seconds versus 21.9 seconds for A. Its
AST-backed exact and relaxed usage evidence was the strongest demonstrated MCP
value, but the manual A answer remained more direct and scored slightly higher.

The simple-query B run correctly made no MCP call and scored 20/20. Both
scenarios whose ground truth said rawsql was unnecessary avoided rawsql calls;
the ambiguous request still scored poorly because neither agent asked what
"better" meant. That is an agent clarification problem, not missing SQL
capability.

The JSONL trace does not enumerate a complete discovered-tool inventory. It
does prove that the ten-tool server was configured, that the host rejected the
`slice_query` spec described below, and that the agent materialized and called
only `find_query_usage` from the rawsql catalog.

## Host compatibility gap

Every B run emitted this Codex-host warning:

```text
Skipping deferred MCP tool `mcp__rawsqlslice_query`: failed to build tool spec:
invalid type: map, expected a string
```

It appeared 51 times across 10 of 10 B scenarios. `slice_query` never became
callable. This is a host-to-MCP tool-spec compatibility and discoverability gap;
it is not evidence that the core slicing semantics returned an incorrect result,
because the tool never executed.

Consequently, the run did not demonstrate `extract_cte_query` versus
`slice_query`, `validate_sql` versus `inspect_query_contract`, compact versus
full views, or a column-lineage workflow. The correlated-`EXISTS` agent still
failed closed manually and emitted no unsafe standalone SQL, but MCP-backed
slice safety was not exercised.

## Product interpretation

What rawsql-ts concretely added in this run was exhaustive, AST-backed
cross-file usage evidence. The agent already handled aggregate multiplication,
query contracts, optional predicates, CTEs, and safety reasoning well enough
from the supplied SQL in most scenarios, and it did not autonomously select the
corresponding rawsql tools.

No rawsql result correctness defect was confirmed among calls that executed.
The repeated evidence is instead:

- high-severity actual-host compatibility friction for `slice_query`;
- high-severity tool-discoverability friction, with rawsql selected in only one
  of eight useful scenarios;
- noisy over-investigation in the one exercised impact workflow;
- no multi-scenario answer-quality improvement attributable to MCP.

This evidence does not satisfy the improvement threshold. It also provides no
case, let alone multiple independent cases, where the absence of executable SQL
for only a target output blocked an investigation. Phase 4C remains deferred.

## Open questions and limits

- The run used one fresh A/B pair per scenario. Model and reasoning settings
  were fixed, and run order alternated, but the host exposes no sampling seed.
- The evidence does not isolate whether the `slice_query` spec failure must be
  corrected by the Codex host, the MCP schema producer, or their integration.
  That root cause remains unconfirmed.
- Nine of ten B runs relied entirely on manual SQL reasoning, so the run cannot
  judge the unexercised tool results or compare their answer value.
- This study did not test a rawsql-specific system prompt or server guidance;
  teaching the expected workflow would have invalidated the autonomous tool-
  selection question.

## Evidence boundary

The full JSONL traces, tool responses, answer packets, scores, timings, and
scenario workspaces remain ignored task evidence under
`tmp/agent-dogfooding/`. They are not committed because of their size and host-
specific detail. This durable report records only the method, aggregate result,
and decision-relevant observations.

Source-code changes: none. Documentation changes: this evidence file only. New
tools: none. Changeset: none. Pull request: none.
