<div v-pre>
# Class: SqlParamInjector

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:28](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlParamInjector.ts#L28)

SqlParamInjector injects state parameters into a SelectQuery model,
creating WHERE conditions and setting parameter values.

## Constructors

### Constructor

> **new SqlParamInjector**(`optionsOrResolver?`, `options?`): `SqlParamInjector`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:32](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlParamInjector.ts#L32)

#### Parameters

##### optionsOrResolver?

[`SqlParamInjectorOptions`](../interfaces/SqlParamInjectorOptions.md) | (`tableName`) => `string`[]

##### options?

[`SqlParamInjectorOptions`](../interfaces/SqlParamInjectorOptions.md)

#### Returns

`SqlParamInjector`

## Methods

### inject()

> **inject**(`query`, `state`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:50](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/SqlParamInjector.ts#L50)

Injects parameters as WHERE conditions into the given query model.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

##### state

`Record`&lt;`string`, `number` \| `string` \| `boolean` \| `Date` \| `null` \| `undefined` \| `Condition`\&gt;

A record of parameter names and values

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

The modified SelectQuery

#### Throws

Error when all parameters are undefined and allowAllUndefined is not set to true
</div>
