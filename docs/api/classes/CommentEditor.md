<div v-pre>
# Class: CommentEditor

Defined in: [packages/core/src/utils/CommentEditor.ts:8](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L8)

Utility class for editing comments on SQL components.
Provides functions to add, edit, delete, and search comments in SQL AST.

## Constructors

### Constructor

> **new CommentEditor**(): `CommentEditor`

#### Returns

`CommentEditor`

## Methods

### addComment()

> `static` **addComment**(`component`, `comment`, `position`): `void`

Defined in: [packages/core/src/utils/CommentEditor.ts:17](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L17)

Add a comment to a SQL component using positioned comments system
For SelectQuery components, adds to headerComments for query-level comments
For other components, adds as 'before' positioned comment

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

The SQL component to add comment to

##### comment

`string`

The comment text to add

##### position

Optional position for comment ('before' | 'after'), defaults to 'before'

`"before"` | `"after"`

#### Returns

`void`

***

### editComment()

> `static` **editComment**(`component`, `index`, `newComment`, `position`): `void`

Defined in: [packages/core/src/utils/CommentEditor.ts:53](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L53)

Edit an existing comment by index
For SelectQuery components, edits headerComments
For other components, edits positioned comments

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

The SQL component containing the comment

##### index

`number`

The index of the comment to edit (0-based)

##### newComment

`string`

The new comment text

##### position

Position to edit ('before' | 'after'), defaults to 'before' for non-SelectQuery components

`"before"` | `"after"`

#### Returns

`void`

#### Throws

Error if index is invalid

***

### deleteComment()

> `static` **deleteComment**(`component`, `index`, `position`): `void`

Defined in: [packages/core/src/utils/CommentEditor.ts:82](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L82)

Delete a comment by index
For SelectQuery components, deletes from headerComments
For other components, deletes from positioned comments

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

The SQL component containing the comment

##### index

`number`

The index of the comment to delete (0-based)

##### position

Position to delete from ('before' | 'after'), defaults to 'before' for non-SelectQuery components

`"before"` | `"after"`

#### Returns

`void`

#### Throws

Error if index is invalid

***

### deleteAllComments()

> `static` **deleteAllComments**(`component`): `void`

Defined in: [packages/core/src/utils/CommentEditor.ts:116](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L116)

Delete all comments from a component

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

The SQL component to clear comments from

#### Returns

`void`

***

### getComments()

> `static` **getComments**(`component`): `string`[]

Defined in: [packages/core/src/utils/CommentEditor.ts:132](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L132)

Get all comments from a component
For SelectQuery components, returns headerComments
For other components, returns all positioned comments as a flat array

#### Parameters

##### component

[`SqlComponent`](SqlComponent.md)

The SQL component to get comments from

#### Returns

`string`[]

Array of comment strings (empty array if no comments)

***

### findComponentsWithComment()

> `static` **findComponentsWithComment**(`root`, `searchText`, `caseSensitive`): [`SqlComponent`](SqlComponent.md)[]

Defined in: [packages/core/src/utils/CommentEditor.ts:147](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L147)

Find all components in the AST that have comments containing the search text

#### Parameters

##### root

[`SqlComponent`](SqlComponent.md)

The root SQL component to search from

##### searchText

`string`

The text to search for in comments

##### caseSensitive

`boolean` = `false`

Whether the search should be case-sensitive (default: false)

#### Returns

[`SqlComponent`](SqlComponent.md)[]

Array of components that have matching comments

***

### replaceInComments()

> `static` **replaceInComments**(`root`, `searchText`, `replaceText`, `caseSensitive`): `number`

Defined in: [packages/core/src/utils/CommentEditor.ts:204](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L204)

Replace all occurrences of a text in comments across the entire AST

#### Parameters

##### root

[`SqlComponent`](SqlComponent.md)

The root SQL component to search and replace in

##### searchText

`string`

The text to search for

##### replaceText

`string`

The text to replace with

##### caseSensitive

`boolean` = `false`

Whether the search should be case-sensitive (default: false)

#### Returns

`number`

Number of replacements made

***

### countComments()

> `static` **countComments**(`root`): `number`

Defined in: [packages/core/src/utils/CommentEditor.ts:283](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L283)

Count total number of comments in the AST

#### Parameters

##### root

[`SqlComponent`](SqlComponent.md)

The root SQL component to count comments in

#### Returns

`number`

Total number of comments

***

### getAllComments()

> `static` **getAllComments**(`root`): `object`[]

Defined in: [packages/core/src/utils/CommentEditor.ts:324](https://github.com/mk3008/rawsql-ts/blob/4619bdddf8b0b7537cf8b1b238a86f7bade23d3d/packages/core/src/utils/CommentEditor.ts#L324)

Get all comments from the entire AST as a flat array with their source components

#### Parameters

##### root

[`SqlComponent`](SqlComponent.md)

The root SQL component to extract comments from

#### Returns

`object`[]

Array of objects containing comment text and the component they belong to
</div>
