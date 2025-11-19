<div v-pre>
# Class: CTERenamer

Defined in: [packages/core/src/transformers/CTERenamer.ts:84](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/CTERenamer.ts#L84)

A utility class for renaming Common Table Expressions (CTEs) in SQL queries.

This class provides functionality to safely rename CTEs while automatically updating
all column references and table references throughout the query, including within
nested CTE definitions and subqueries.

## Examples

```typescript
import { CTERenamer, SelectQueryParser } from 'rawsql-ts';

const sql = `
  WITH user_data AS (
    SELECT id, name FROM users
  ),
  order_summary AS (
    SELECT user_data.id, COUNT(*) as order_count
    FROM user_data
    JOIN orders ON user_data.id = orders.user_id
    GROUP BY user_data.id
  )
  SELECT * FROM order_summary
`;

const query = SelectQueryParser.parse(sql);
const renamer = new CTERenamer();

// Rename 'user_data' to 'customer_data'
renamer.renameCTE(query, 'user_data', 'customer_data');

// All references are automatically updated:
// - CTE definition: WITH customer_data AS (...)
// - Column references: customer_data.id
// - Table references: FROM customer_data
```

```typescript
// Error handling
try {
  renamer.renameCTE(query, 'nonexistent_cte', 'new_name');
} catch (error) {
  console.error(error.message); // "CTE 'nonexistent_cte' does not exist"
}

try {
  renamer.renameCTE(query, 'existing_cte', 'already_exists');
} catch (error) {
  console.error(error.message); // "CTE 'already_exists' already exists"
}
```

Related tests: packages/core/tests/transformers/CTERenamer.test.ts

## Since

0.11.16

## Constructors

### Constructor

> **new CTERenamer**(): `CTERenamer`

Defined in: [packages/core/src/transformers/CTERenamer.ts:98](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/CTERenamer.ts#L98)

Creates a new instance of CTERenamer.

The constructor initializes internal collectors and analyzers needed for
comprehensive CTE renaming operations.

#### Returns

`CTERenamer`

## Methods

### renameCTE()

> **renameCTE**(`query`, `oldName`, `newName`): `void`

Defined in: [packages/core/src/transformers/CTERenamer.ts:144](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/CTERenamer.ts#L144)

Renames a Common Table Expression (CTE) and updates all references to it.

This method performs a comprehensive rename operation that includes:
- Updating the CTE definition name in the WITH clause
- Updating all column references (e.g., `old_name.column` -> `new_name.column`)
- Updating all table references in FROM and JOIN clauses
- Processing references within nested CTEs and subqueries

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The SQL query containing the CTE to rename. Can be either SimpleSelectQuery or BinarySelectQuery (UNION/INTERSECT/EXCEPT).

##### oldName

`string`

The current name of the CTE to rename.

##### newName

`string`

The new name for the CTE.

#### Returns

`void`

#### Throws

When the specified CTE does not exist in the query.

#### Throws

When a CTE with the new name already exists.

#### Throws

When the query type is not supported (not a SelectQuery).

#### Example

```typescript
const renamer = new CTERenamer();

// Basic usage
renamer.renameCTE(query, 'old_cte_name', 'new_cte_name');

// With error handling
try {
  renamer.renameCTE(query, 'user_data', 'customer_data');
} catch (error) {
  if (error.message.includes('does not exist')) {
    console.log('CTE not found');
  } else if (error.message.includes('already exists')) {
    console.log('Name conflict');
  }
}
```

Related tests: packages/core/tests/transformers/CTERenamer.test.ts

#### Since

0.11.16

***

### renameCTEAtPosition()

> **renameCTEAtPosition**(`sql`, `position`, `newName`): `string`

Defined in: [packages/core/src/transformers/CTERenamer.ts:418](https://github.com/mk3008/rawsql-ts/blob/06f158deb6834abe60efae28a401b9ba4bb89ac2/packages/core/src/transformers/CTERenamer.ts#L418)

GUI-integrated CTE renaming with line/column position support.

Designed for editor integration where users can right-click on CTE names
and rename them. Automatically detects the CTE name at the cursor position
and performs the rename operation.

#### Parameters

##### sql

`string`

The complete SQL string containing CTE definitions

##### position

[`LineColumn`](../interfaces/LineColumn.md)

Line and column position where the user clicked (1-based)

##### newName

`string`

The new name for the CTE

#### Returns

`string`

The updated SQL string with the CTE renamed

#### Throws

When no CTE name is found at the specified position

#### Throws

When the new name conflicts with existing CTE names

#### Example

```typescript
const sql = `
  WITH user_data AS (SELECT * FROM users),
       order_data AS (SELECT * FROM orders)
  SELECT * FROM user_data JOIN order_data ON ...
`;

const renamer = new CTERenamer();
// User right-clicks on 'user_data' at line 2, column 8
const result = renamer.renameCTEAtPosition(sql, { line: 2, column: 8 }, 'customer_data');
console.log(result);
// Returns SQL with 'user_data' renamed to 'customer_data' everywhere
```
</div>
