<div v-pre>
# Class: CTEQueryDecomposer

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:87](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/CTEQueryDecomposer.ts#L87)

Decomposes complex CTEs into executable standalone queries

This class analyzes Common Table Expressions and generates executable standalone queries
for each CTE, making complex CTE debugging easier. It supports:
- Recursive CTE detection and handling
- Dependency analysis (dependencies and dependents for each CTE)  
- CTE SQL Restoration: Generate executable SQL for a specific CTE with its dependencies
- Configurable SQL formatter options (MySQL, PostgreSQL, custom styles)
- Optional comment generation showing CTE metadata and relationships
- Comprehensive error handling for circular dependencies

## Example

```typescript
const decomposer = new CTEQueryDecomposer({
  preset: 'postgres',
  addComments: true,
  keywordCase: 'upper'
});

const query = `
  with users_data as (select * from users),
       active_users as (select * from users_data where active = true)
  select * from active_users
`;

const decomposed = decomposer.decompose(SelectQueryParser.parse(query));
// Returns array of DecomposedCTE objects with executable queries

// Or restore a specific CTE for debugging:
const restored = decomposer.extractCTE(SelectQueryParser.parse(query), 'active_users');
console.log(restored.executableSql); // Standalone executable SQL with dependencies
```

## Constructors

### Constructor

> **new CTEQueryDecomposer**(`options`): `CTEQueryDecomposer`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:111](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/CTEQueryDecomposer.ts#L111)

Creates a new CTEQueryDecomposer instance

#### Parameters

##### options

[`CTEDecomposerOptions`](../interfaces/CTEDecomposerOptions.md) = `{}`

Configuration options extending SqlFormatterOptions

#### Returns

`CTEQueryDecomposer`

## Methods

### decompose()

> **decompose**(`query`): [`DecomposedCTE`](../interfaces/DecomposedCTE.md)[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:148](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/CTEQueryDecomposer.ts#L148)

Decomposes CTEs in a query into executable standalone queries

This method analyzes the query structure to:
1. Collect all CTEs and analyze their dependencies
2. Detect recursive CTEs and handle them separately
3. Generate executable queries for each CTE including required dependencies
4. Add optional comments with metadata (if addComments option is enabled)
5. Format output according to specified formatter options

#### Parameters

##### query

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The SimpleSelectQuery containing CTEs to decompose

#### Returns

[`DecomposedCTE`](../interfaces/DecomposedCTE.md)[]

Array of decomposed CTEs with executable queries, dependencies, and metadata

#### Throws

Error if circular dependencies are detected in non-recursive CTEs

#### Example

```typescript
const query = SelectQueryParser.parse(`
  with base as (select * from users),
       filtered as (select * from base where active = true)
  select * from filtered
`);

const result = decomposer.decompose(query);
// Returns:
// [
//   { name: 'base', query: 'select * from users', dependencies: [], ... },
//   { name: 'filtered', query: 'with base as (...) select * from base where active = true', dependencies: ['base'], ... }
// ]
```

***

### synchronize()

> **synchronize**(`editedCTEs`, `rootQuery`): [`DecomposedCTE`](../interfaces/DecomposedCTE.md)[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:190](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/CTEQueryDecomposer.ts#L190)

Synchronizes edited CTEs back into a unified query and re-decomposes them

This method resolves inconsistencies between edited CTEs by:
1. Composing the edited CTEs into a unified query
2. Parsing the unified query to ensure consistency
3. Re-decomposing the synchronized query

This is useful when CTEs have been edited independently and may have
inconsistencies that need to be resolved through a unified composition.

#### Parameters

##### editedCTEs

`object`[]

Array of edited CTEs that may have inconsistencies

##### rootQuery

`string`

The main query that uses the CTEs

#### Returns

[`DecomposedCTE`](../interfaces/DecomposedCTE.md)[]

Array of re-decomposed CTEs with resolved inconsistencies

#### Throws

Error if the composed query cannot be parsed or contains errors

#### Example

```typescript
// After editing CTEs independently, synchronize them
const editedCTEs = [
  { name: 'users_data', query: 'select * from users where active = true' },
  { name: 'active_users', query: 'select * from users_data where id >= 1000' }
];

const synchronized = decomposer.synchronize(editedCTEs, 'select count(*) from active_users');
// Returns re-decomposed CTEs with resolved dependencies
```

***

### extractCTE()

> **extractCTE**(`query`, `cteName`): [`CTERestorationResult`](../interfaces/CTERestorationResult.md)

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:249](https://github.com/mk3008/rawsql-ts/blob/8426433abb6f727425f333ca1e1200e90752ea40/packages/core/src/transformers/CTEQueryDecomposer.ts#L249)

Restores executable SQL for a specific CTE by including all its dependencies

This method provides a focused API for generating standalone, executable SQL
for a specific Common Table Expression. It analyzes dependencies and includes
all required CTEs in the correct execution order.

Key features:
- Automatic dependency resolution and ordering
- Recursive CTE detection and handling  
- Error handling for circular dependencies
- Optional dependency comments for debugging

#### Parameters

##### query

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The query containing CTEs

##### cteName

`string`

The name of the CTE to restore

#### Returns

[`CTERestorationResult`](../interfaces/CTERestorationResult.md)

CTERestorationResult with executable SQL and metadata

#### Throws

Error if CTE is not found or circular dependencies exist

#### Example

```typescript
const query = SelectQueryParser.parse(`
  with users_data as (select * from users),
       active_users as (select * from users_data where active = true),
       premium_users as (select * from active_users where premium = true)
  select * from premium_users
`);

// Get executable SQL for 'premium_users' CTE
const result = decomposer.extractCTE(query, 'premium_users');
// result.executableSql will contain:
// with users_data as (select * from users),
//      active_users as (select * from users_data where active = true)
// select * from active_users where premium = true
```
</div>
