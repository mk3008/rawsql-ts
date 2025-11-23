<div v-pre>
# Enumeration: DuplicateDetectionMode

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:5](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/SelectableColumnCollector.ts#L5)

Enum for duplicate detection modes in SelectableColumnCollector.
Determines how duplicates are identified during column collection.

## Enumeration Members

### ColumnNameOnly

> **ColumnNameOnly**: `"columnNameOnly"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:11](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/SelectableColumnCollector.ts#L11)

Detect duplicates based only on column names.
This mode ignores the table name, so columns with the same name
from different tables are considered duplicates.

***

### FullName

> **FullName**: `"fullName"`

Defined in: [packages/core/src/transformers/SelectableColumnCollector.ts:17](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/SelectableColumnCollector.ts#L17)

Detect duplicates based on both table and column names.
This mode ensures that columns with the same name from different
tables are treated as distinct.
</div>
