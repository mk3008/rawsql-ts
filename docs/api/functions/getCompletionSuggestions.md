<div v-pre>
# Function: getCompletionSuggestions()

> **getCompletionSuggestions**(`sql`, `cursorPosition`): `object`[]

Defined in: [packages/core/src/utils/IntelliSenseApi.ts:180](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/IntelliSenseApi.ts#L180)

Get completion suggestions based on cursor context and scope

Uses the new IntelliSense interface to provide targeted completion suggestions.
This function leverages the suggestion-based design to efficiently determine
what completions should be offered.

## Parameters

### sql

`string`

SQL text

### cursorPosition

Cursor position

`number` | [`LineColumn`](../interfaces/LineColumn.md)

## Returns

`object`[]

Array of completion suggestions with context information
</div>
