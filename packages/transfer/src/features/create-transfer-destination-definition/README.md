# create-transfer-destination-definition

Creates one `transfer_destination_definition` row.

This feature is intentionally scoped to the create use case. Do not rename or reshape it into a table-level `transfer-destination-definitions` CRUD feature.

## Input

The public feature boundary accepts `CreateTransferDestinationDefinitionInput` with camelCase fields:

- `name`
- `description`
- `destinationTableName`
- `destinationColumns`
- `destinationKeyDefinition`
- `sequenceExpressionDefinition`
- `transferModel`
- `signInversionColumns`
- `redTransferSourceColumns`
- `diffCompareExcludedColumns`
- `note`

## Validation

The feature boundary validates the minimum create rules before calling the query boundary:

- non-blank `name`
- non-blank `destinationTableName`
- at least one `destinationColumns.columns` entry
- unique `destinationColumns.columns[].name`
- at least one `destinationKeyDefinition.keys` entry
- referenced key, sequence, sign inversion, red-transfer source, and diff-excluded columns exist in `destinationColumns.columns`
- allowed `transferModel` values

Duplicate `transfer_destination_definition_name` values are not preflighted in the feature SQL. The database unique constraint owns that fail-fast behavior.

## SQL

The query boundary lives under `queries/insert-transfer-destination-definition/`.

`insert-transfer-destination-definition.sql` explicitly lists caller-supplied columns, casts JSONB values, omits `created_at` and `updated_at` so the DB defaults apply, and returns the inserted row.

## RFBA Note

Feature-specific validation remains local to this feature. `src/libraries/` is reserved for logic that can stand on its own as a reusable package-level library.
