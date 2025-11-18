$---
title: MERGE-to-SELECT Conversion
outline: deep
---

# MERGE ? SELECT Conversion

`MergeResultSelectConverter` transforms a `MERGE` statement into a read-only query that counts the rows that would be inserted, updated, and deleted. That query is built from the same target, source, and join predicates that the real merge exploits.

## Conversion workflow

1. Parse each branch (`WHEN MATCHED`, `WHEN NOT MATCHED`, `WHEN NOT MATCHED BY SOURCE`) and produce a `SELECT 1` expression that reflects its action semantics.
2. Union the action rows and wrap them in a `WITH "__merge_action_rows"` CTE so the final query can simply `SELECT count(*) AS "count"` from that CTE.
3. Keep the target/source joins and predicates intact so the read path observes the same matching logic as the merge.
4. Inject fixture CTEs for the target and every referenced source table before combining them with the rewritten query.

## Fixtures and coverage

The converter needs fixtures for every base table that the merge touches, otherwise it raises a fixture coverage error. Fixtures are injected through `fixtureTables`, but you can also let the converter fall back to the real tables by using `missingFixtureStrategy: passthrough`. The converter does not enforce fixtures for CTE aliases so you may shadow only the underlying tables.

## When to read this doc

- You want to know how `MergeResultSelectConverter` turns each merge action into a union of selects.
- You need to add fixtures for a new source table that the merge now references.
- You are validating the generated `SELECT count(*)` that emerges when the merge converts to read-only code in the testkit.

## Learn more

- [MergeResultSelectConverter API](../api/classes/MergeResultSelectConverter.md)
- [Select-Centered Philosophy](./select-centered-philosophy.md)
- [SQLite Testkit Guide](./sqlite-testkit-howto.md)

