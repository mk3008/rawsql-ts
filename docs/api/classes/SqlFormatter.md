<div v-pre>
# Class: SqlFormatter

Defined in: [packages/core/src/transformers/SqlFormatter.ts:123](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/transformers/SqlFormatter.ts#L123)

High level facade that parses a SqlComponent, applies formatting rules, and prints the final SQL text.

## Example

```typescript
const formatter = new SqlFormatter({ keywordCase: 'lower', withClauseStyle: 'cte-oneline' });
const query = SelectQueryParser.parse('WITH cte AS (SELECT id FROM users) SELECT * FROM cte');
const { formattedSql } = formatter.format(query);
```
Related tests: packages/core/tests/transformers/SqlFormatter.case.test.ts

## Constructors

### Constructor

> **new SqlFormatter**(`options`): `SqlFormatter`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:127](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/transformers/SqlFormatter.ts#L127)

#### Parameters

##### options

[`SqlFormatterOptions`](../interfaces/SqlFormatterOptions.md) = `{}`

#### Returns

`SqlFormatter`

## Methods

### format()

> **format**(`sql`): `object`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:190](https://github.com/mk3008/rawsql-ts/blob/a144fd7d4226a2aae5356e601ddda75e9b266e1b/packages/core/src/transformers/SqlFormatter.ts#L190)

Formats a SQL query string with the given parameters.

#### Parameters

##### sql

[`SqlComponent`](SqlComponent.md)

#### Returns

`object`

An object containing the formatted SQL string and the parameters.

##### formattedSql

> **formattedSql**: `string`

##### params

> **params**: `any`[] \| `Record`&lt;`string`, `any`\&gt;
</div>
