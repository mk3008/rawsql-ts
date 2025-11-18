<div v-pre>
# Class: CTEComposer

Defined in: [packages/core/src/transformers/CTEComposer.ts:61](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/CTEComposer.ts#L61)

Composes edited CTEs back into a unified SQL query

Takes CTEs that were individually edited after decomposition and reconstructs them
into a proper WITH clause structure. This completes the CTE debugging workflow:
1. Use CTEQueryDecomposer to break down complex CTEs
2. Edit individual CTEs to fix issues  
3. Use CTEComposer to reconstruct the unified query

## Example

```typescript
// After decomposing and editing CTEs
const composer = new CTEComposer({ 
  preset: 'postgres',
  validateSchema: true,
  schema: { users: ['id', 'name', 'active'] }
});

const editedCTEs = [
  { name: 'base_data', query: 'select * from users where active = true' },
  { name: 'filtered_data', query: 'select * from base_data where region = "US"' }
];

const composedSQL = composer.compose(editedCTEs, 'select * from filtered_data');
// Dependencies are automatically analyzed and sorted
// Result: "with base_data as (...), filtered_data as (...) select * from filtered_data"
```

## Constructors

### Constructor

> **new CTEComposer**(`options`): `CTEComposer`

Defined in: [packages/core/src/transformers/CTEComposer.ts:71](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/CTEComposer.ts#L71)

Creates a new CTEComposer instance

#### Parameters

##### options

[`CTEComposerOptions`](../interfaces/CTEComposerOptions.md) = `{}`

Configuration options extending SqlFormatterOptions

#### Returns

`CTEComposer`

## Methods

### compose()

> **compose**(`editedCTEs`, `rootQuery`): `string`

Defined in: [packages/core/src/transformers/CTEComposer.ts:105](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/CTEComposer.ts#L105)

Compose edited CTEs and root query into a unified SQL query

This method:
1. Extracts pure SELECT queries from edited CTEs (removes any WITH clauses)
2. Builds a temporary query to analyze dependencies automatically
3. Sorts CTEs by dependency order using topological sort
4. Validates schema if options.validateSchema is enabled
5. Applies formatter options for consistent output
6. Constructs the final WITH clause with proper recursive handling

#### Parameters

##### editedCTEs

[`EditedCTE`](../interfaces/EditedCTE.md)[]

Array of edited CTEs with name and query only

##### rootQuery

`string`

The main query that uses the CTEs (without WITH clause)

#### Returns

`string`

Composed SQL query with properly structured WITH clause

#### Throws

Error if schema validation fails or circular dependencies are detected

#### Example

```typescript
const editedCTEs = [
  { name: 'base_data', query: 'select * from users where active = true' },
  { name: 'filtered_data', query: 'select * from base_data where region = "US"' }
];

const result = composer.compose(editedCTEs, 'select count(*) from filtered_data');
// Dependencies automatically analyzed and sorted
// Result: "with base_data as (...), filtered_data as (...) select count(*) from filtered_data"
```
</div>
