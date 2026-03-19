---
title: JOIN Direction Lint Specification
---

# JOIN Direction Lint Specification

`ztd query lint --rules join-direction` is a conservative readability check for SQL that encourages a stable join direction across a project.

The goal is not to prove that one query is semantically wrong. The goal is to reduce review noise, AI-generated drift, and cognitive load by making join paths easier to read and compare.

## Purpose

This lint looks for inner-join patterns where the query walks **from a parent table down to a child table** even though DDL already defines a clear FK path in the opposite direction.

The preferred style in v1 is:

- start from the child table
- join upward to the parent table
- keep direction consistent within a query when practical

## Truth source

v1 uses **FK-only** relation evidence.

The relation graph is built from explicit DDL metadata only:

- column-level `REFERENCES`
- table-level `FOREIGN KEY`

The lint does not infer relation direction from:

- naming conventions
- join predicates that are not backed by explicit FK evidence
- PK / UNIQUE candidate keys
- application code or runtime behavior

## v1 scope

### In scope

- top-level `SELECT` statements
- normal `JOIN` / `INNER JOIN`
- queries whose join path can be matched to an explicit FK edge
- opt-in execution through `ztd query lint --rules join-direction`

### Out of scope

- `LEFT JOIN` and other non-inner join forms
- bridge-table / many-to-many path reasoning
- self-reference-heavy trees
- ambiguous parent candidates
- deeper subquery / CTE / `EXISTS` reasoning
- automatic rewrites or auto-fixes
- default-on rollout

## Classification table

| Pattern | v1 outcome | Why |
|---|---|---|
| `child -> parent` inner join | clean | This matches the preferred upward direction. |
| `parent -> child` inner join | warning | The query walks against the preferred FK direction. |
| `child -> parent -> child` chain | warning if the chain reverses direction in a readable FK path | Direction flips increase cognitive load and review noise. |
| `LEFT JOIN` that keeps the parent row | skip | v1 avoids flagging outer-join intent. |
| Bridge / many-to-many path | skip | v1 conservatively avoids multi-hop inference that is often intentional. |
| Aggregate or parent-shaped query | skip | The subject is often not the first table in the `FROM` clause, so direction is ambiguous. |
| Explicit suppression comment | skip | The author has stated that the reverse path is intentional. |
| Ambiguous join target / missing FK edge | skip | v1 avoids guessing when relation evidence is incomplete. |

## Warning cases

These are the cases the lint is designed to report.

### 1. Parent -> child inner join

Example:

```sql
select *
from public.customers c
join public.orders o on o.customer_id = c.customer_id
```

If DDL defines `orders.customer_id references customers.customer_id`, the join is walking from parent to child. The lint reports a warning with `join_type`, `subject_table`, `joined_table`, `child_table`, and `parent_table`.

### 2. Readability-breaking direction reversal inside a chain

Example:

```sql
select *
from public.order_items oi
join public.orders o on o.order_id = oi.order_id
join public.order_items oi2 on oi2.order_id = o.order_id
```

The first join may be acceptable, but a direction flip inside the same chain makes the path harder to read. v1 warns only when the FK evidence is clear enough to avoid false positives.

## Skip cases

These cases are deliberately skipped in v1.

### LEFT JOIN

Synthetic fixture:

- `packages/ztd-cli/tests/fixtures/join-direction/left-join.sql`

Real repo example:

- `packages/ztd-cli/tests/utils/taxAllocationScenario.ts`

Why skip:

- outer join intent is usually about preserving rows, not join direction style
- many reporting queries intentionally keep the parent or fact table on the left

### Bridge / many-to-many

Synthetic fixture:

- `packages/ztd-cli/tests/fixtures/join-direction/bridge.sql`

Why skip:

- a bridge table often has two valid parent directions
- without stronger inference, the lint would over-report on normal many-to-many reporting queries

### Aggregate / parent-shaped query

Synthetic fixture:

- `packages/ztd-cli/tests/fixtures/join-direction/aggregate.sql`

Real repo example:

- `packages/ztd-cli/tests/utils/taxAllocationScenario.ts`

Why skip:

- the apparent `FROM` table is not always the real subject
- aggregates and grouped projections often intentionally pivot around a parent-shaped result

### No usable join graph

Real repo example:

- `packages/ztd-cli/src/specs/sql/usersList.catalog.ts`

Why skip:

- the SQL has no meaningful FK-backed join direction to evaluate
- warning here would not help readability

## Suppression cases

Use suppression when the reverse direction is intentional and should remain in the query.

### Supported syntax

```sql
-- ztd-lint-disable join-direction
```

Synthetic fixture:

- `packages/ztd-cli/tests/fixtures/join-direction/suppressed.sql`

Use suppression when:

- the query is intentionally written from a reporting or UX shape
- the reverse direction is clearer for the business question
- a local exception is more honest than forcing a rewrite

## Synthetic and real examples

### Synthetic fixtures

- `forward.sql`: child -> parent join, clean
- `reverse.sql`: parent -> child join, warning
- `left-join.sql`: outer join intent, skip
- `bridge.sql`: many-to-many / bridge path, skip
- `aggregate.sql`: aggregate / parent-shaped query, skip
- `suppressed.sql`: explicit suppression, skip

### Real repo SQL

- `packages/ztd-cli/src/specs/sql/activeOrders.catalog.ts`
  - clean because the observed join path already follows child -> parent direction
- `packages/ztd-cli/src/specs/sql/usersList.catalog.ts`
  - skipped because there is no join graph to evaluate
- `packages/ztd-cli/tests/utils/taxAllocationScenario.ts`
  - skipped because the query is parent-shaped and uses `LEFT JOIN`

## Diagnostics shape

The lint emits structured diagnostics that are available in both text and JSON output.

Representative JSON shape:

```json
{
  "type": "join-direction",
  "severity": "warning",
  "message": "JOIN direction is reversed for public.orders -> public.customers; prefer starting from the child table and joining upward",
  "join_type": "join",
  "subject_table": "public.customers",
  "joined_table": "public.orders",
  "child_table": "public.orders",
  "parent_table": "public.customers",
  "child_columns": ["customer_id"],
  "parent_columns": ["customer_id"]
}
```

Text output uses the same message:

```text
WARN  join-direction: JOIN direction is reversed for public.orders -> public.customers; prefer starting from the child table and joining upward
```

## Heuristic notes

The v1 heuristics are intentionally conservative:

- if the join direction cannot be proven, skip it
- if the query is bridge-shaped, skip it
- if the query is outer-join-heavy or aggregate-shaped, skip it
- if the author explicitly suppresses the rule, do not re-litigate the choice

This is deliberate. The first release is trying to create a reliable guard, not to maximize recall.

## Future expansion candidates

### PK / UNIQUE inference

Future versions may infer parent candidates from:

- `PRIMARY KEY`
- `UNIQUE`
- additional schema metadata that implies a single authoritative parent row

### Overlay-based relation modeling

The current relation graph already carries evidence and confidence fields. That shape can support an overlay model where:

- FK-backed edges remain confirmed
- inferred edges are attached as a separate layer
- diagnostics can explain whether a relation is confirmed or inferred

This may be easier to evolve than replacing confirmed FK edges with inferred rows.

### Deeper query reasoning

Future work may extend coverage to:

- nested subqueries
- CTE chains
- `EXISTS`
- more complex parent-shape detection

Those are intentionally left out of v1 to keep the initial rule stable and low-noise.
