<div v-pre>
# Class: SchemaCollector

Defined in: [packages/core/src/transformers/SchemaCollector.ts:39](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SchemaCollector.ts#L39)

Collects schema information (table names and resolved columns) from SelectQuery instances.

## Example

```typescript
const collector = new SchemaCollector((table) => ['id', 'name']);
const query = SelectQueryParser.parse('SELECT id, name FROM users');
const schemas = collector.collect(query);
```
Related tests: packages/core/tests/transformers/SchemaCollector.test.ts

## Implements

- [`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md)&lt;`void`\&gt;

## Constructors

### Constructor

> **new SchemaCollector**(`tableColumnResolver`, `allowWildcardWithoutResolver`): `SchemaCollector`

Defined in: [packages/core/src/transformers/SchemaCollector.ts:52](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SchemaCollector.ts#L52)

#### Parameters

##### tableColumnResolver

`null` | [`TableColumnResolver`](../type-aliases/TableColumnResolver.md)

##### allowWildcardWithoutResolver

`boolean` = `false`

#### Returns

`SchemaCollector`

## Methods

### collect()

> **collect**(`arg`): [`TableSchema`](TableSchema.md)[]

Defined in: [packages/core/src/transformers/SchemaCollector.ts:70](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SchemaCollector.ts#L70)

Collects schema information (table names and column names) from a SQL query structure.
This method ensures that the collected schema information is unique and sorted.
The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

The SQL query structure to analyze.

#### Returns

[`TableSchema`](TableSchema.md)[]

***

### analyze()

> **analyze**(`arg`): [`SchemaAnalysisResult`](../interfaces/SchemaAnalysisResult.md)

Defined in: [packages/core/src/transformers/SchemaCollector.ts:83](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SchemaCollector.ts#L83)

Analyzes schema information from a SQL query structure without throwing errors.
Returns a result object containing successfully resolved schemas, unresolved columns,
and error information if any issues were encountered.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

The SQL query structure to analyze.

#### Returns

[`SchemaAnalysisResult`](../interfaces/SchemaAnalysisResult.md)

Analysis result containing schemas, unresolved columns, and success status.

***

### visit()

> **visit**(`arg`): `void`

Defined in: [packages/core/src/transformers/SchemaCollector.ts:112](https://github.com/mk3008/rawsql-ts/blob/32bd620456f37d0f73edb1a04e1d0fdef970cd1c/packages/core/src/transformers/SchemaCollector.ts#L112)

Main entry point for the visitor pattern.
Implements the shallow visit pattern to distinguish between root and recursive visits.

This method ensures that schema information is collected uniquely and sorted.
The resulting schemas and columns are sorted alphabetically to ensure deterministic ordering.

#### Parameters

##### arg

[`SqlComponent`](SqlComponent.md)

The SQL component to visit.

#### Returns

`void`

#### Implementation of

[`SqlComponentVisitor`](../interfaces/SqlComponentVisitor.md).[`visit`](../interfaces/SqlComponentVisitor.md#visit)
</div>
