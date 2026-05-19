# RFBA AOT hasMany Generation Scope

Status: first scoped implementation added for explicit metadata. This document intentionally keeps the generated one-to-many scope narrow.

## Goal

Generate one-to-many DTO aggregation for RFBA query boundaries without making users choose a special performance mode. The generated mapper should remain a machine-owned internal artifact under `generated/**`, and `boundary.ts` should stay thin.

## First Supported Shape

The first implementation should support only this shape:

| area | supported scope |
|---|---|
| root | One root object. |
| collection | One `hasMany` collection on the root. |
| rows | Flat joined SQL rows. |
| parent identity | Explicit parent key metadata. |
| child identity | Explicit child key metadata. |
| child presence | Explicit child presence guard, normally the nullable child key from a left join. |
| order | Preserve SQL row order for roots and child arrays. |
| mapping | Generated direct assignment. |
| hot loop | No object spread, no generic key walking, no relation inference inside the loop. |
| boundary | `boundary.ts` imports and calls the generated mapper only; aggregation details stay generated/internal. |

## Required Metadata

The generator should require metadata that can be validated before generation:

```ts
type HasManyGenerationMetadata = {
  kind: 'hasMany';
  root: {
    name: string;
    key: readonly string[];
    columns: Record<string, string>;
  };
  collection: {
    property: string;
    key: readonly string[];
    presence: readonly string[];
    columns: Record<string, string>;
  };
};
```

Rules:

- `root.key` and `collection.key` must not be empty.
- `collection.presence` must not be empty.
- Every key and presence column must exist in the SQL row contract.
- `columns` maps DTO property names to SQL row column names explicitly.
- Composite keys are allowed only if column order is explicit and stable.
- Generated mapper metadata is parsed with `JSON.parse` from the `*GeneratedMapperMetadata` object literal. The object literal itself must be JSON-compatible: quoted object keys and string values, no comments, no trailing commas, no spreads, no computed values, and no TypeScript identifiers inside the parsed object. Type annotations or `satisfies` clauses may sit outside the object literal.
- Generated root keys use typed, length-prefixed segments, so delimiter characters inside individual key values do not collide with composite keys.
- The generated mapper must preserve SQL row order. It should not sort.
- In this first scope, `collection.key` is validated metadata for safety and future deduplication work; the generated mapper does not deduplicate children and therefore preserves SQL row multiplicity.

## Non-goals

Do not include these in the first implementation:

- deep graph generation
- many-to-many materialization
- polymorphic relations
- relation inference from aliases alone
- PostgreSQL JSON aggregation as a RFBA generated mapper path
- hand edits under `generated/**`
- a public "fast mapper mode" option

## Generated Mapper Shape

The generated mapper should follow this shape:

```ts
export function mapQueryRowsToResult(rows: QueryRow[]): QueryResult {
  const items: QueryResult['items'] = [];
  const rootIndex = new Map<string, QueryResult['items'][number]>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rootKey = serializeGeneratedKey(row.root_id);
    let root = rootIndex.get(rootKey);
    if (root === undefined) {
      root = {
        id: row.root_id,
        children: [],
      };
      rootIndex.set(rootKey, root);
      items.push(root);
    }

    if (row.child_id !== null && row.child_id !== undefined) {
      root.children.push({
        id: row.child_id,
      });
    }
  }

  return { items };
}
```

The exact generated output should be deterministic: stable property order, stable helper names, and stable formatting.

## Safety Checks

Generation should fail with a visible fallback reason when:

- required metadata is missing
- a declared key column is not present in the row contract
- a presence guard is missing
- a collection property conflicts with a root property
- the output cardinality cannot be expressed as one root plus one collection

Fallback should remain compatibility-oriented. The standard scaffold success path should use the generated mapper.

## Implementation Status

Implemented in this pass:

- JSON-compatible generated mapper metadata can describe one `hasMany` relation without a runtime package dependency.
- ztd-cli generated mapper sync can detect one explicit `hasMany` relation from JSON-compatible query metadata.
- The first generator entrypoint reads a JSON-compatible `*GeneratedMapperMetadata` constant that can be assigned to queryspec `metadata`; arbitrary inline `metadata` object parsing is intentionally out of scope. Parse failures explain that the metadata object literal must stay JSON-compatible and show the regeneration/check failure before CI can pass.
- The generated mapper uses root indexing, SQL row-order preservation, direct assignment, and no object spread in the hot loop.
- Missing or unsafe metadata fails generation with a visible reason instead of guessing relations from aliases.
- The generated mapper is exercised with fixture rows to verify root grouping, child ordering, and nullable child presence guards.

Still not implemented:

- automatic metadata derivation from DDL or query analysis
- multiple collections
- deep graph generation
- DB-backed behavioral fixtures for generated hasMany output

## Acceptance Criteria for Further Implementation

- A generated boundary metadata example can generate one root plus one collection.
- The generated mapper uses direct assignment and does not use object spread in the hot loop.
- The generated mapper is under `generated/**` and is covered by generated mapper drift check.
- The query boundary stays thin.
- Missing metadata produces a clear fallback/generation failure reason.
- Generated output is stable after repeated regeneration.
- Fixture rows prove the generated mapper returns the expected DTO shape before DB-backed tests are added.
