<div v-pre>
# Class: SqlParamInjector

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:31](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/SqlParamInjector.ts#L31)

SqlParamInjector injects state parameters into a SelectQuery model,
creating WHERE conditions and setting parameter values.

## Constructors

### Constructor

> **new SqlParamInjector**(`optionsOrResolver?`, `options?`): `SqlParamInjector`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:35](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/SqlParamInjector.ts#L35)

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

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:53](https://github.com/mk3008/rawsql-ts/blob/97899341ea23d20c7f2ce4609e59e508e45a84c2/packages/core/src/transformers/SqlParamInjector.ts#L53)

Injects parameters as WHERE conditions into the given query model.

#### Parameters

##### query

The SelectQuery to modify

`string` | [`SimpleSelectQuery`](SimpleSelectQuery.md)

##### state

`Record`&lt;`string`, [`StateParameterValue`](../type-aliases/StateParameterValue.md) \| `null` \| `undefined`\&gt;

A record of parameter names and values

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

The modified SelectQuery

#### Throws

Error when all parameters are undefined and allowAllUndefined is not set to true
</div>
