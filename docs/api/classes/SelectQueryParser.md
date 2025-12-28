<div v-pre>
# Class: SelectQueryParser

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:31](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L31)

Legacy SELECT-only parser.
Prefer using SqlParser as the canonical entry point for multi-statement or mixed-statement workflows.

## Constructors

### Constructor

> **new SelectQueryParser**(): `SelectQueryParser`

#### Returns

`SelectQueryParser`

## Methods

### parse()

> `static` **parse**(`query`): [`SelectQuery`](../interfaces/SelectQuery.md)

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:33](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L33)

#### Parameters

##### query

`string`

#### Returns

[`SelectQuery`](../interfaces/SelectQuery.md)

***

### analyze()

> `static` **analyze**(`query`): [`ParseAnalysisResult`](../interfaces/ParseAnalysisResult.md)

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:86](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L86)

#### Parameters

##### query

`string`

#### Returns

[`ParseAnalysisResult`](../interfaces/ParseAnalysisResult.md)

***

### parseAsync()

> `static` **parseAsync**(`query`): `Promise`&lt;[`SelectQuery`](../interfaces/SelectQuery.md)\&gt;

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:142](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L142)

Asynchronously parse SQL string to AST.
This method wraps the synchronous parse logic in a Promise for future extensibility.

#### Parameters

##### query

`string`

SQL string to parse

#### Returns

`Promise`&lt;[`SelectQuery`](../interfaces/SelectQuery.md)\&gt;

`Promise<SelectQuery>`

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:191](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L191)

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

##### index

`number`

#### Returns

`object`

##### value

> **value**: [`SelectQuery`](../interfaces/SelectQuery.md)

##### newIndex

> **newIndex**: `number`

***

### ~~getCursorCte()~~

> `static` **getCursorCte**(`sql`, `cursorPosition`): `null` \| `string`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:631](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L631)

Get the CTE name at the specified cursor position.

This method provides a simple interface for retrieving the CTE name
based on a 1D cursor position in the SQL text.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### cursorPosition

`number`

The cursor position (0-based character offset)

#### Returns

`null` \| `string`

The CTE name if cursor is in a CTE, null otherwise

#### Deprecated

Use CTERegionDetector.getCursorCte() instead for better API consistency

#### Example

```typescript
const sql = `WITH users AS (SELECT * FROM table) SELECT * FROM users`;
const cteName = SelectQueryParser.getCursorCte(sql, 25);
console.log(cteName); // "users"
```

***

### ~~getCursorCteAt()~~

> `static` **getCursorCteAt**(`sql`, `line`, `column`): `null` \| `string`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:654](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L654)

Get the CTE name at the specified 2D coordinates (line, column).

This method provides a convenient interface for editor integrations
that work with line/column coordinates instead of character positions.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### line

`number`

The line number (1-based)

##### column

`number`

The column number (1-based)

#### Returns

`null` \| `string`

The CTE name if cursor is in a CTE, null otherwise

#### Deprecated

Use CTERegionDetector.getCursorCteAt() instead for better API consistency

#### Example

```typescript
const sql = `WITH users AS (\n  SELECT * FROM table\n) SELECT * FROM users`;
const cteName = SelectQueryParser.getCursorCteAt(sql, 2, 5);
console.log(cteName); // "users"
```

***

### ~~positionToLineColumn()~~

> `static` **positionToLineColumn**(`text`, `position`): `null` \| \{ `line`: `number`; `column`: `number`; \}

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:666](https://github.com/mk3008/rawsql-ts/blob/3694f22c4fff67ce981d69b1be52d0a4e9e2f730/packages/core/src/parsers/SelectQueryParser.ts#L666)

Convert character position to line/column coordinates.

#### Parameters

##### text

`string`

The text to analyze

##### position

`number`

The character position (0-based)

#### Returns

`null` \| \{ `line`: `number`; `column`: `number`; \}

Object with line and column (1-based), or null if invalid position

#### Deprecated

Use CTERegionDetector.positionToLineColumn() instead for better API consistency
</div>
