<div v-pre>
# Type Alias: CommentStyle

> **CommentStyle** = `"block"` \| `"smart"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:26](https://github.com/mk3008/rawsql-ts/blob/d48ef1e4aa20926f9b07d25e21de5be68d0d6807/packages/core/src/transformers/SqlFormatter.ts#L26)

CommentStyle determines how comments are formatted in the output.
- 'block': Keep original comment style (default)
- 'smart': Convert single-line to --, multi-line to block comments, optimize for comma break styles
</div>
