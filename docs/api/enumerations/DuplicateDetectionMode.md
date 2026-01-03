<div v-pre>
# Enumeration: DuplicateDetectionMode

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:5](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/SelectableColumnCollector.ts#L5)

Enum for duplicate detection modes in SelectableColumnCollector.
Determines how duplicates are identified during column collection.

## Enumeration Members

### ColumnNameOnly

> **ColumnNameOnly**: `"columnNameOnly"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:11](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/SelectableColumnCollector.ts#L11)

Detect duplicates based only on column names.
This mode ignores the table name, so columns with the same name
from different tables are considered duplicates.

***

### FullName

> **FullName**: `"fullName"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:17](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/transformers/SelectableColumnCollector.ts#L17)

Detect duplicates based on both table and column names.
This mode ensures that columns with the same name from different
tables are treated as distinct.
</div>
