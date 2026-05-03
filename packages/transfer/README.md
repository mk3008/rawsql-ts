# @rawsql-ts/transfer

`@rawsql-ts/transfer` contains transfer-definition features for rawsql-ts workflows.

The initial features register transfer destination definitions and transfer settings for PostgreSQL transfer workflows.

## Transfer Destination Definition

The `transfer_destination_definition` table stores:

- the destination table name
- destination column metadata
- destination key metadata
- optional sequence-expression metadata
- transfer model
- optional red-transfer and diff-comparison column metadata

DDL lives in `db/ddl/transfer_destination_definition.sql`.

## Transfer Model

### transfer_model

| Value | Meaning |
| --- | --- |
| `immutable` | Add a red-transfer row for the old black row, then add a new black row on update. Add a red-transfer row on delete. |
| `mutable` | Directly update an existing transferred row on update. Physically delete the row on delete. |

## Transfer Setting

The `transfer_setting` table stores the source SQL text, a deterministic source SQL hash, and analysis placeholders.
Source SQL parsing is intentionally out of scope for the create feature; new rows save `source_sql_analysis_status` as `not_analyzed`.

## Feature Boundary

`src/features/create-transfer-destination-definition/` owns the create destination definition use case.
`src/features/create-transfer-setting/` owns the create transfer setting use case.

The destination feature accepts `CreateTransferDestinationDefinitionInput` with `transferModel`.
The setting feature accepts `CreateTransferSettingInput`, resolves destination definitions by name, and creates the setting plus one or more destination links transactionally.

Feature-specific validation stays inside this feature. Do not move this validation into `src/libraries/` unless it becomes independent enough to extract as a reusable external package.
