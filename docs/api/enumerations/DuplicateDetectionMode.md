<div v-pre>
# Enumeration: DuplicateDetectionMode

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:5](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/SelectableColumnCollector.ts#L5)

Enum for duplicate detection modes in SelectableColumnCollector.
Determines how duplicates are identified during column collection.

## Enumeration Members

### ColumnNameOnly

> **ColumnNameOnly**: `"columnNameOnly"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:11](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/SelectableColumnCollector.ts#L11)

Detect duplicates based only on column names.
This mode ignores the table name, so columns with the same name
from different tables are considered duplicates.

***

### FullName

> **FullName**: `"fullName"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:17](https://github.com/mk3008/rawsql-ts/blob/931f6c594a3d00fa39b6fcdb6143e285443101ee/packages/core/src/transformers/SelectableColumnCollector.ts#L17)

Detect duplicates based on both table and column names.
This mode ensures that columns with the same name from different
tables are treated as distinct.
</div>
