<div v-pre>
# Interface: PositionParseResult

Defined in: [packages/core/src/utils/PositionAwareParser.ts:25](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L25)

Result of position-aware parsing

## Extends

- [`ParseAnalysisResult`](ParseAnalysisResult.md)

## Properties

### success

> **success**: `boolean`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:22](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/SelectQueryParser.ts#L22)

#### Inherited from

[`ParseAnalysisResult`](ParseAnalysisResult.md).[`success`](ParseAnalysisResult.md#success)

***

### query?

> `optional` **query**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:23](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/SelectQueryParser.ts#L23)

#### Inherited from

[`ParseAnalysisResult`](ParseAnalysisResult.md).[`query`](ParseAnalysisResult.md#query)

***

### error?

> `optional` **error**: `string`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:24](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/SelectQueryParser.ts#L24)

#### Inherited from

[`ParseAnalysisResult`](ParseAnalysisResult.md).[`error`](ParseAnalysisResult.md#error)

***

### errorPosition?

> `optional` **errorPosition**: `number`

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:25](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/SelectQueryParser.ts#L25)

#### Inherited from

[`ParseAnalysisResult`](ParseAnalysisResult.md).[`errorPosition`](ParseAnalysisResult.md#errorposition)

***

### remainingTokens?

> `optional` **remainingTokens**: `string`[]

Defined in: [packages/core/src/parsers/SelectQueryParser.ts:26](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/parsers/SelectQueryParser.ts#L26)

#### Inherited from

[`ParseAnalysisResult`](ParseAnalysisResult.md).[`remainingTokens`](ParseAnalysisResult.md#remainingtokens)

***

### parsedTokens?

> `optional` **parsedTokens**: [`Lexeme`](Lexeme.md)[]

Defined in: [packages/core/src/utils/PositionAwareParser.ts:27](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L27)

Tokens that were parsed up to the cursor position

***

### tokenBeforeCursor?

> `optional` **tokenBeforeCursor**: [`Lexeme`](Lexeme.md)

Defined in: [packages/core/src/utils/PositionAwareParser.ts:29](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L29)

Token immediately before the cursor position

***

### stoppedAtCursor?

> `optional` **stoppedAtCursor**: `boolean`

Defined in: [packages/core/src/utils/PositionAwareParser.ts:31](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L31)

Whether parsing stopped at the cursor position

***

### recoveryAttempts?

> `optional` **recoveryAttempts**: `number`

Defined in: [packages/core/src/utils/PositionAwareParser.ts:33](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L33)

Number of error recovery attempts made

***

### partialAST?

> `optional` **partialAST**: [`SelectQuery`](SelectQuery.md)

Defined in: [packages/core/src/utils/PositionAwareParser.ts:35](https://github.com/mk3008/rawsql-ts/blob/efa96500610e9fc3a9f71149a5ff13c786488297/packages/core/src/utils/PositionAwareParser.ts#L35)

Partial AST even if parsing failed
</div>
