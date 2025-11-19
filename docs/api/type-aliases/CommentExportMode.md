<div v-pre>
# Type Alias: CommentExportMode

> **CommentExportMode** = `"none"` \| `"full"` \| `"header-only"` \| `"top-header-only"`

Defined in: [packages/core/src/types/Formatting.ts:8](https://github.com/mk3008/rawsql-ts/blob/4ed5433376f3d2e35a68a48a1db4b0391ec65db1/packages/core/src/types/Formatting.ts#L8)

Comment export modes controlling which comments are emitted.
- 'full': emit every comment (legacy `true` behaviour)
- 'none': suppress all comments (legacy `false` behaviour)
- 'header-only': emit only leading comments for each container
- 'top-header-only': emit leading comments only when the container is top-level
</div>
