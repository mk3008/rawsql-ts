<div v-pre>
# Class: PositionAwareParser

Defined in: [packages/core/src/utils/PositionAwareParser.ts:57](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/PositionAwareParser.ts#L57)

Position-aware SQL parser with error recovery for IntelliSense

Extends the standard parser to handle incomplete SQL and provide context
for IntelliSense scenarios where users are actively typing.

## Example

```typescript
// Parse incomplete SQL with error recovery
const sql = "SELECT user.name FROM users user WHERE user.";
const result = PositionAwareParser.parseToPosition(sql, sql.length, {
  errorRecovery: true,
  insertMissingTokens: true
});

console.log(result.tokenBeforeCursor?.value); // "."
console.log(result.success); // true (with recovery)
```

## Constructors

### Constructor

> **new PositionAwareParser**(): `PositionAwareParser`

#### Returns

`PositionAwareParser`

## Methods

### parseToPosition()

> `static` **parseToPosition**(`sql`, `cursorPosition`, `options`): [`PositionParseResult`](../interfaces/PositionParseResult.md)

Defined in: [packages/core/src/utils/PositionAwareParser.ts:66](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/PositionAwareParser.ts#L66)

Parse SQL text up to a specific position with error recovery

#### Parameters

##### sql

`string`

SQL text to parse

##### cursorPosition

Character position to parse up to (0-based) or line/column

`number` | [`LineColumn`](../interfaces/LineColumn.md)

##### options

[`ParseToPositionOptions`](../interfaces/ParseToPositionOptions.md) = `{}`

Parsing options including error recovery

#### Returns

[`PositionParseResult`](../interfaces/PositionParseResult.md)

Parse result with position-specific information

***

### parseCurrentQuery()

> `static` **parseCurrentQuery**(`sql`, `cursorPosition`, `options`): [`PositionParseResult`](../interfaces/PositionParseResult.md)

Defined in: [packages/core/src/utils/PositionAwareParser.ts:113](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/utils/PositionAwareParser.ts#L113)

Parse current query from multi-query text at cursor position

#### Parameters

##### sql

`string`

Complete SQL text (may contain multiple statements)

##### cursorPosition

Cursor position

`number` | [`LineColumn`](../interfaces/LineColumn.md)

##### options

[`ParseToPositionOptions`](../interfaces/ParseToPositionOptions.md) = `{}`

Parsing options

#### Returns

[`PositionParseResult`](../interfaces/PositionParseResult.md)

Parse result for the current query only
</div>
