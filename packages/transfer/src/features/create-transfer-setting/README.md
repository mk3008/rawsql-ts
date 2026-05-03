# create-transfer-setting

Creates one `transfer_setting` row and one or more `transfer_setting_destination_definition` rows.

This feature is intentionally scoped to the create use case. Do not reshape it into a table-level `transfer-settings` CRUD feature.

## Input

The public feature boundary accepts `CreateTransferSettingInput` with camelCase fields:

- `name`
- `description`
- `sourceSqlBody`
- `isEnabled`
- `note`
- `destinations`

Each destination item contains:

- `destinationDefinitionName`
- `executionOrder`
- `sourceKeyDefinition`
- `mappingDefinition`
- `isEnabled`
- `note`

## Validation

`input.ts` validates external input before the workflow starts:

- non-blank `name`
- non-blank `sourceSqlBody`
- at least one destination
- positive integer `executionOrder`
- unique `executionOrder` within the input
- unique `destinationDefinitionName` within the input
- object-shaped `sourceKeyDefinition`
- object-shaped `mappingDefinition`

Destination definitions are resolved by `transfer_destination_definition_name` before inserting the setting row.
Unknown destination definitions fail the operation before any setting row is inserted.

## Boundary Shape

The public boundary follows the RFBA review order:

1. parse input
2. execute workflow
3. build output

`workflow.ts` owns the transaction, destination definition lookup, source SQL hashing, and inserts.
`output.ts` only reshapes generated query results into the public return value.
It does not revalidate DB rows with Zod; DB constraints, queryspec contracts, generated row mappers, and ZTD tests cover the SQL/result binding path.

## SQL

The feature owns three query boundaries:

- `queries/resolve-transfer-destination-definitions/`
- `queries/insert-transfer-setting/`
- `queries/insert-transfer-setting-destination-definition/`

The feature requires a transactional executor and runs all three query steps inside one transaction.
Generated SQL body columns are saved as empty strings, `generated_sql_status` is saved as `not_generated`, and `generated_sql_error` is saved as `null`.

## Source SQL Analysis

Full source SQL parsing is intentionally out of scope for this issue.
The feature only stores a deterministic SHA-256 hash of `sourceSqlBody`.
Analysis result fields are saved as `null`, and `source_sql_analysis_status` is saved as `not_analyzed`.
