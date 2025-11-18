<div v-pre>
# Interface: QueryInfo

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:7](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L7)

Information about a single query within multi-query text

## Properties

### sql

> **sql**: `string`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:9](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L9)

SQL text of this query

***

### start

> **start**: `number`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:11](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L11)

Start position in the original text (0-based character offset)

***

### end

> **end**: `number`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:13](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L13)

End position in the original text (0-based character offset)

***

### startLine

> **startLine**: `number`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:15](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L15)

Line number where query starts (1-based)

***

### endLine

> **endLine**: `number`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:17](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L17)

Line number where query ends (1-based)

***

### index

> **index**: `number`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:19](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L19)

Query index in the original text (0-based)

***

### isEmpty

> **isEmpty**: `boolean`

Defined in: [packages/core/src/utils/MultiQuerySplitter.ts:21](https://github.com/mk3008/rawsql-ts/blob/50886164fc846d18024a28a60370e980d03ef1bd/packages/core/src/utils/MultiQuerySplitter.ts#L21)

Whether this query is empty or contains only whitespace/comments
</div>
