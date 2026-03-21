<div v-pre>
# Class: ParameterHelper

Defined in: [packages/core/src/utils/ParameterHelper.ts:7](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/ParameterHelper.ts#L7)

Utility class for parameter operations on SQL queries.

## Constructors

### Constructor

> **new ParameterHelper**(): `ParameterHelper`

#### Returns

`ParameterHelper`

## Methods

### set()

> `static` **set**(`query`, `name`, `value`): `void`

Defined in: [packages/core/src/utils/ParameterHelper.ts:15](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/ParameterHelper.ts#L15)

Sets the value of a parameter by name in the given query.
Throws an error if the parameter is not found.

#### Parameters

##### query

[`SqlComponent`](SqlComponent.md)

The query object (must be a SqlComponent)

##### name

`string`

Parameter name

##### value

`any`

Value to set

#### Returns

`void`
</div>
