<div v-pre>
# Type Alias: CommentStyle

> **CommentStyle** = `"block"` \| `"smart"`

Defined in: [packages/core/src/transformers/SqlFormatter.ts:26](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/transformers/SqlFormatter.ts#L26)

CommentStyle determines how comments are formatted in the output.
- 'block': Keep original comment style (default)
- 'smart': Convert single-line to --, multi-line to block comments, optimize for comma break styles
</div>
