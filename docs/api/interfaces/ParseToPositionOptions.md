<div v-pre>
# Interface: ParseToPositionOptions

Defined in: [packages/core/src/utils/PositionAwareParser.ts:11](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/PositionAwareParser.ts#L11)

Options for position-aware parsing

## Properties

### errorRecovery?

> `optional` **errorRecovery**: `boolean`

Defined in: [packages/core/src/utils/PositionAwareParser.ts:13](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/PositionAwareParser.ts#L13)

Enable error recovery to continue parsing after syntax errors

***

### insertMissingTokens?

> `optional` **insertMissingTokens**: `boolean`

Defined in: [packages/core/src/utils/PositionAwareParser.ts:15](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/PositionAwareParser.ts#L15)

Insert missing tokens (e.g., missing FROM keywords)

***

### parseToPosition?

> `optional` **parseToPosition**: `number` \| \{ `line`: `number`; `column`: `number`; \}

Defined in: [packages/core/src/utils/PositionAwareParser.ts:17](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/PositionAwareParser.ts#L17)

Parse only up to the specified position

***

### maxRecoveryAttempts?

> `optional` **maxRecoveryAttempts**: `number`

Defined in: [packages/core/src/utils/PositionAwareParser.ts:19](https://github.com/mk3008/rawsql-ts/blob/a59e3ea64dee225318ef045179f256984bc4cfe6/packages/core/src/utils/PositionAwareParser.ts#L19)

Maximum number of error recovery attempts
</div>
