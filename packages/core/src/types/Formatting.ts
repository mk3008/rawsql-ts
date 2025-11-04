/**
 * Comment export modes controlling which comments are emitted.
 * - 'full': emit every comment (legacy `true` behaviour)
 * - 'none': suppress all comments (legacy `false` behaviour)
 * - 'header-only': emit only leading comments for each container
 * - 'top-header-only': emit leading comments only when the container is top-level
 */
export type CommentExportMode = 'none' | 'full' | 'header-only' | 'top-header-only';

