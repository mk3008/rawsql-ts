<div v-pre>
# Interface: SqlParamInjectorOptions

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:15](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/SqlParamInjector.ts#L15)

Options for SqlParamInjector

## Properties

### ignoreCaseAndUnderscore?

> `optional` **ignoreCaseAndUnderscore**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:17](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/SqlParamInjector.ts#L17)

Whether to ignore case and underscore differences when matching column names

***

### allowAllUndefined?

> `optional` **allowAllUndefined**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:19](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/SqlParamInjector.ts#L19)

Whether to allow injection when all parameters are undefined (defaults to false for safety)

***

### ignoreNonExistentColumns?

> `optional` **ignoreNonExistentColumns**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:21](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/SqlParamInjector.ts#L21)

Whether to ignore non-existent columns instead of throwing errors (defaults to false for safety)
</div>
