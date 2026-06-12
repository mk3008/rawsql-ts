# create-transfer-destination-definition

Creates one `destination_definition` row.

This feature is intentionally scoped to the create use case. Do not rename or reshape it into a table-level `transfer-destination-definitions` CRUD feature.

## Input

The public feature boundary accepts `CreateTransferDestinationDefinitionInput` with camelCase fields:

- `name`
- `description`
- `destinationTableName`
- `destinationColumns`
- `destinationKeyColumns`
- `sequenceExpressionDefinition`
- `transferModel`
- `signInversionColumns`
- `note`

## Validation

The feature boundary validates the minimum create rules before calling the query boundary:

- non-blank `name`
- non-blank, fully qualified, unique `destinationTableName`
- at least one `destinationColumns.columns` entry
- unique `destinationColumns.columns[].name`
- at least one `destinationKeyColumns` entry
- referenced key, sequence, and sign inversion columns exist in `destinationColumns.columns`
- allowed `transferModel` values

Duplicate `destination_definition_name` and `destination_table_name` values are not preflighted in the feature SQL. The database unique constraints own that fail-fast behavior.

Transfer-setting-specific diff comparison exclusions are intentionally not part of Destination Definition input.
Those exclusions belong to the Transfer Setting Destination Link.

## SQL

The query boundary lives under `queries/insert-transfer-destination-definition/`.

`insert-transfer-destination-definition.sql` explicitly lists caller-supplied columns, casts structured values, omits generated red-transfer SQL and timestamps so the DB defaults apply, and returns the inserted row.

## RFBA Note

Feature-specific validation remains local to this feature. `src/libraries/` is reserved for logic that can stand on its own as a reusable package-level library.
