<div v-pre>
# Type Alias: CommentStyle

> **CommentStyle** = `"block"` \| `"smart"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:26](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/transformers/SqlFormatter.ts#L26)

CommentStyle determines how comments are formatted in the output.
- 'block': Keep original comment style (default)
- 'smart': Convert single-line to --, multi-line to block comments, optimize for comma break styles
</div>
