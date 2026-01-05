<div v-pre>
# Class: LexemeCursor

Defined in: [packages/core/src/utils/LexemeCursor.ts:25](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/LexemeCursor.ts#L25)

Utility class for cursor-to-lexeme mapping in SQL text.

Provides functionality to find lexemes at specific cursor positions for IDE integration.
Handles SQL parsing with proper comment and whitespace handling for editor features.

## Example

```typescript
const sql = "SELECT id FROM users WHERE active = true";
const lexeme = LexemeCursor.findLexemeAtPosition(sql, 7); // position at 'id'
console.log(lexeme?.value); // 'id'
```

## Constructors

### Constructor

> **new LexemeCursor**(): `LexemeCursor`

#### Returns

`LexemeCursor`

## Methods

### findLexemeAtLineColumn()

> `static` **findLexemeAtLineColumn**(`sql`, `position`): `null` \| [`Lexeme`](../interfaces/Lexeme.md)

Defined in: [packages/core/src/utils/LexemeCursor.ts:48](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/LexemeCursor.ts#L48)

Find the lexeme at the specified line and column position.

Designed for GUI editor integration where users select alias text.
Uses 1-based line and column indexing to match editor conventions.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### position

[`LineColumn`](../interfaces/LineColumn.md)

Line and column position (1-based)

#### Returns

`null` \| [`Lexeme`](../interfaces/Lexeme.md)

The lexeme at the position, or null if not found

#### Example

```typescript
const sql = "SELECT user_id FROM orders";
const lexeme = LexemeCursor.findLexemeAtLineColumn(sql, { line: 1, column: 8 });
console.log(lexeme?.value); // 'user_id'
```

***

### findLexemeAtPosition()

> `static` **findLexemeAtPosition**(`sql`, `cursorPosition`): `null` \| [`Lexeme`](../interfaces/Lexeme.md)

Defined in: [packages/core/src/utils/LexemeCursor.ts:73](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/LexemeCursor.ts#L73)

Find the lexeme at the specified cursor position.

Performs intelligent SQL parsing with proper comment and whitespace handling.
Returns null if cursor is in whitespace or comments.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### cursorPosition

`number`

The cursor position (0-based character offset)

#### Returns

`null` \| [`Lexeme`](../interfaces/Lexeme.md)

The lexeme at the position, or null if not found

#### Example

```typescript
const sql = "SELECT user_id FROM orders";
const lexeme = LexemeCursor.findLexemeAtPosition(sql, 7);
console.log(lexeme?.value); // 'user_id'
```

***

### getAllLexemesWithPosition()

> `static` **getAllLexemesWithPosition**(`sql`): [`Lexeme`](../interfaces/Lexeme.md)[]

Defined in: [packages/core/src/utils/LexemeCursor.ts:107](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/LexemeCursor.ts#L107)

Get all lexemes with position information from SQL text.

Tokenizes the entire SQL string with precise position information.
Useful for syntax highlighting, code analysis, and editor features.

#### Parameters

##### sql

`string`

The SQL string to tokenize

#### Returns

[`Lexeme`](../interfaces/Lexeme.md)[]

Array of lexemes with position information (excludes comments/whitespace)

#### Example

```typescript
const sql = "SELECT id FROM users";
const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
lexemes.forEach(l => console.log(`${l.value} at ${l.position.startPosition}`));
```

***

### charOffsetToLineColumn()

> `static` **charOffsetToLineColumn**(`sql`, `charOffset`): `null` \| [`LineColumn`](../interfaces/LineColumn.md)

Defined in: [packages/core/src/utils/LexemeCursor.ts:323](https://github.com/mk3008/rawsql-ts/blob/3d7678f88db64ace33375c092bf5dd94b6428633/packages/core/src/utils/LexemeCursor.ts#L323)

Convert character offset to line and column position.

#### Parameters

##### sql

`string`

The SQL string

##### charOffset

`number`

Character offset (0-based)

#### Returns

`null` \| [`LineColumn`](../interfaces/LineColumn.md)

Line and column position (1-based), or null if offset is out of bounds
</div>
