# @rawsql-ts/transfer

`@rawsql-ts/transfer` contains transfer-definition features for rawsql-ts workflows.

The first feature is `create-transfer-destination-definition`. It registers one `transfer_destination_definition` row for a PostgreSQL destination table definition.

## Transfer Destination Definition

The `transfer_destination_definition` table stores:

- the destination table name
- destination column metadata
- destination key metadata
- optional sequence-expression metadata
- update and delete transfer policies
- optional red-transfer and diff-comparison column metadata

DDL lives in `db/ddl/transfer_destination_definition.sql`.

## Policy Values

### update_transfer_policy

| Value | Meaning |
| --- | --- |
| `overwrite` | Overwrite an existing transferred destination row on update. |
| `immutable` | Add a red-transfer row for the old black row, then add a new black row on update. |

### delete_transfer_policy

| Value | Meaning |
| --- | --- |
| `physical_delete` | Physically delete the destination row on delete. |
| `immutable` | Add a red-transfer row from the original black row on delete. |
| `ignore` | Do nothing when a delete request is received. |

## Feature Boundary

`src/features/create-transfer-destination-definition/` owns the create use case.

The feature accepts `CreateTransferDestinationDefinitionInput` from `boundary.ts`, validates the request, maps it to the query boundary, and returns the inserted row using camelCase names.

Feature-specific validation stays inside this feature. Do not move this validation into `src/libraries/` unless it becomes independent enough to extract as a reusable external package.
