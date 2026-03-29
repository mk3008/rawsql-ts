<div v-pre>
# Class: SqlParameterBinder

Defined in: [packages/core/src/transformers/SqlParameterBinder.ts:23](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/SqlParameterBinder.ts#L23)

SqlParameterBinder binds values to existing hardcoded parameters in SQL queries.

This transformer is designed to work with SQL queries that already contain
parameter placeholders (e.g., :param_name) and bind actual values to them.

Unlike SqlParamInjector which creates new WHERE conditions, this transformer
only sets values for parameters that already exist in the parsed SQL.

## Constructors

### Constructor

> **new SqlParameterBinder**(`options`): `SqlParameterBinder`

Defined in: [packages/core/src/transformers/SqlParameterBinder.ts:26](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/SqlParameterBinder.ts#L26)

#### Parameters

##### options

[`SqlParameterBinderOptions`](../interfaces/SqlParameterBinderOptions.md) = `{}`

#### Returns

`SqlParameterBinder`

## Methods

### bind()

> **bind**(`query`, `parameterValues`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SqlParameterBinder.ts:40](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/SqlParameterBinder.ts#L40)

Binds values to existing hardcoded parameters in the query.

#### Parameters

##### query

[`SelectQuery`](../interfaces/SelectQuery.md)

The SelectQuery to modify

##### parameterValues

`Record`&lt;`string`, `any`\&gt;

A record of parameter names and values to bind

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

The modified SelectQuery with parameter values set

#### Throws

Error when required parameters are missing values

***

### bindToSimpleQuery()

> **bindToSimpleQuery**(`query`, `parameterValues`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SqlParameterBinder.ts:86](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/SqlParameterBinder.ts#L86)

Convenience method to bind parameters to a SimpleSelectQuery.

#### Parameters

##### query

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The SimpleSelectQuery to modify

##### parameterValues

`Record`&lt;`string`, `any`\&gt;

A record of parameter names and values to bind

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

The modified SelectQuery with parameter values set
</div>
