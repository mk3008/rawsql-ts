# MCP Product Gate Evidence — 2026-08

## Evidence boundary

This gate evaluated the ten-tool `@rawsql-ts/mcp-server` catalog as a local,
static, read-only SQL investigation surface. It did not connect to a database,
execute SQL, inspect rows, or mutate project SQL files.

The initial A–J run used the MCP SDK `Client` with `InMemoryTransport` and
captured the actual tool schemas and serialized responses. It found one
correctness failure: adding a boolean sibling changed an `EXISTS` scope into a
`scalar_subquery` scope and changed its V1 selector. PR #970 fixed the core
classification and added core, investigation, and MCP regressions.

The final close was run on main commit
`d7e02be4fbe81b2df6bb0d55064ad30ef6d91e65`, the merge commit for PR #970.

Repository evidence consists of the merged core and MCP regressions, the
catalog test, and this final report. The initial ignored harness, raw MCP
responses, timings, and worker/evaluator packets were supplementary task
evidence used for adjudication; they are intentionally not copied into this
durable document.

## Main close evidence

The main checkout contained all expected fix artifacts:

- operand-relative classification in `QueryScopeCollector`;
- compound-predicate selector stability tests in core;
- the MCP Scenario B fail-closed regression;
- a `rawsql-ts` patch Changeset.

The MCP close check used `analyze_query_structure` with `view: "full"`, passed
the returned selector unchanged to `slice_query`, and covered:

1. bare `EXISTS`;
2. `EXISTS` followed by an `AND` sibling;
3. an `AND` sibling followed by `EXISTS`;
4. `EXISTS` followed by an `OR` sibling.

Every case returned:

- `scopeKind: "exists"`;
- an expression-subquery selector with `subqueryKind: "exists"`, index `0`,
  and version `1`;
- selector key `v1/root/expression:where:exists:0`;
- `outerReferenceStatus: "correlated"`;
- a blocked slice with no SQL artifact;
- no MCP transport or tool error.

`listTools` returned ten tools. The merged Product Gate regression and the
focused core parser, query-scope analysis, query-slice, MCP server, and catalog
checks passed on the same main checkout. PR #970's required CI and consumer
checks were green before the final close.

## Revised A–J result

| Result | Count |
| --- | ---: |
| Pass | 7 |
| Pass with friction | 3 |
| Fail | 0 |

Scenario B moved from fail to pass. The remaining friction did not produce an
unsafe ready result, a selector contradiction, an invalid validation result,
or another correctness blocker.

## Remaining observations

| Observation | Classification | Gate effect |
| --- | --- | --- |
| Correlated subqueries can emit `deadlink_unknown_qualified_source` warnings for aliases that are valid in their local or outer scope. | Diagnostic correctness friction | Non-blocking: scope selection and slicing remain correct and fail closed. |
| An unresolved slice does not make the possible next step of supplying DDL sufficiently discoverable. | Usability | Non-blocking: DDL can already resolve provable ownership without changing the contract. |
| Full lineage output is large. | Verbosity | Non-blocking: compact-first avoids the cost until detailed evidence is required. |
| Aggregate and window investigations do not always receive executable probe SQL. | Future enhancement | Non-blocking: static investigation still succeeds, and this is not evidence for output-column slicing by itself. |
| Condition optimization can report successful rewrites alongside ambiguous skipped-placement noise. | Usability | Non-blocking: applied and skipped evidence remains explicit and safe-only. |

No item is admitted to the backlog by this gate. The dead-link diagnostic and
aggregate/window probe coverage are the strongest watch-list candidates if
future investigations show concrete user blockage. The other observations are
currently guidance or presentation friction, not an independent product
backlog commitment.

## Evidence limits

- The gate proves the local static MCP contract, not database runtime behavior.
- In-memory MCP transport exercises schemas and serialization but not a
  particular host's visual presentation.
- Catalog sufficiency is a dated product judgment, not proof that no future
  workflow can justify another tool.

The durable product decision derived from this evidence is recorded in
[MCP Product Decision — 2026-08](./mcp-product-decision-2026-08.md).
