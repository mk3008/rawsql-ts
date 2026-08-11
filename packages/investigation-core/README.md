# @rawsql-ts/investigation-core

Deterministic static SQL investigation operations built on rawsql-ts.

## Capabilities

- Analyze query structure, including physical tables, CTEs, derived queries,
  nesting, and row-set-changing operations.
- Analyze one uniquely named final output column and produce lineage evidence.
- Generate a value-free fixture capture plan when SQL and supplied DDL prove a
  bounded extraction boundary.

The package does not connect to a database, execute SQL, inspect rows, or infer
runtime parameter values.

## Usage

```ts
import { analyzeQueryStructure } from '@rawsql-ts/investigation-core';

const result = analyzeQueryStructure({
  sql: 'select customer_id, sum(amount) from orders group by customer_id',
});
```

API output shape review: public operations return structured models. Generated
SQL remains an explicitly labeled artifact inside those models rather than the
only transformation result.
