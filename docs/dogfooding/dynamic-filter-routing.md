# Dynamic Filter Routing Dogfooding

This scenario preserves the routing rule between binding existing mandatory placeholders and authoring new `SSSQL` optional branches.

## Use this scenario when

Use this scenario when a prompt sounds like:

- "Add an optional search filter to this query."
- "Should this be handled by DynamicQueryBuilder or by SSSQL?"
- "This query already has hardcoded predicates; which ones are mandatory and which ones are removable?"

## Happy-path routing

1. Check whether the requested filter only touches columns already available in the current query.
2. If the predicate already exists in SQL, bind the existing placeholder only.
3. If the request would add a new removable condition, switch to `SSSQL`.
4. Keep hardcoded predicates mandatory unless the SQL explicitly authors a removable SSSQL branch.
5. Use `optionalConditionParameters` only for those explicitly removable branches.

## Regression surface

- Test file: `packages/core/tests/transformers/DynamicFilterRoutingDogfooding.test.ts`
- Test name: `dogfood: dynamic filters stay on DynamicQueryBuilder when the query already exposes the target columns`
- Test name: `dogfood: SSSQL covers optional filters that need tables outside the current query graph`
- Test name: `dogfood: hardcoded predicates stay mandatory while removable SSSQL branches prune on null`

## What this scenario protects

- AI does not recommend runtime injection of new optional predicates.
- AI switches to SSSQL when a filter needs tables that are not already in the query.
- Mandatory hardcoded predicates are not confused with removable SSSQL branches.
