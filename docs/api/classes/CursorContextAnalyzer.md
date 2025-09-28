<div v-pre>
# Class: CursorContextAnalyzer

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:60](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/CursorContextAnalyzer.ts#L60)

## Constructors

### Constructor

> **new CursorContextAnalyzer**(): `CursorContextAnalyzer`

#### Returns

`CursorContextAnalyzer`

## Methods

### analyzeIntelliSense()

> `static` **analyzeIntelliSense**(`sql`, `cursorPosition`): [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:206](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/CursorContextAnalyzer.ts#L206)

Analyze cursor position for IntelliSense suggestions

Direct implementation that determines what suggestions can be provided
without legacy context conversion overhead.

#### Parameters

##### sql

`string`

SQL text to analyze

##### cursorPosition

`number`

Character position (0-based)

#### Returns

[`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

IntelliSense context focused on what suggestions can be provided

***

### analyzeIntelliSenseAt()

> `static` **analyzeIntelliSenseAt**(`sql`, `position`): [`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)

Defined in: [packages/core/src/utils/CursorContextAnalyzer.ts:365](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/utils/CursorContextAnalyzer.ts#L365)

Analyze cursor position for IntelliSense at line/column position

#### Parameters

##### sql

`string`

##### position

[`LineColumn`](../interfaces/LineColumn.md)

#### Returns

[`IntelliSenseContext`](../interfaces/IntelliSenseContext.md)
</div>
