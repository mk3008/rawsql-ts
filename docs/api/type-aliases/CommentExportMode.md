<div v-pre>
# Type Alias: CommentExportMode

> **CommentExportMode** = `"none"` \| `"full"` \| `"header-only"` \| `"top-header-only"`

Defined in: [packages/core/src/types/Formatting.ts:8](https://github.com/mk3008/rawsql-ts/blob/9d78b38bce5ba5c7fb3babe52a60d8f5587a75bf/packages/core/src/types/Formatting.ts#L8)

Comment export modes controlling which comments are emitted.
- 'full': emit every comment (legacy `true` behaviour)
- 'none': suppress all comments (legacy `false` behaviour)
- 'header-only': emit only leading comments for each container
- 'top-header-only': emit leading comments only when the container is top-level
</div>
