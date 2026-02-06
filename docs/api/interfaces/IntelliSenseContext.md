<div v-pre>
# Interface: IntelliSenseContext

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:10](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L10)

IntelliSense context focused on what suggestions can be provided

## Properties

### suggestTables

> **suggestTables**: `boolean`

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:12](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L12)

Whether to suggest table names (can provide actual table list)

***

### suggestColumns

> **suggestColumns**: `boolean`

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:15](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L15)

Whether to suggest column names (can provide actual column list)

***

### suggestKeywords

> **suggestKeywords**: `boolean`

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:18](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L18)

Whether to suggest SQL keywords (can provide keyword list)

***

### tableScope?

> `optional` **tableScope**: `string`

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:21](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L21)

If suggesting columns, limit to this table's columns (for table.| syntax)

***

### requiredKeywords?

> `optional` **requiredKeywords**: `string`[]

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:24](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L24)

If suggesting keywords, these specific keywords are required

***

### currentToken?

> `optional` **currentToken**: [`Lexeme`](Lexeme.md)

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:29](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L29)

Token at cursor position (if any)

***

### previousToken?

> `optional` **previousToken**: [`Lexeme`](Lexeme.md)

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:32](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CursorContextAnalyzer.ts#L32)

Token immediately before cursor position
</div>
