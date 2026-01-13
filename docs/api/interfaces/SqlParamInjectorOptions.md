<div v-pre>
# Interface: SqlParamInjectorOptions

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:15](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/transformers/SqlParamInjector.ts#L15)

Options for SqlParamInjector

## Properties

### ignoreCaseAndUnderscore?

> `optional` **ignoreCaseAndUnderscore**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:17](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/transformers/SqlParamInjector.ts#L17)

Whether to ignore case and underscore differences when matching column names

***

### allowAllUndefined?

> `optional` **allowAllUndefined**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:19](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/transformers/SqlParamInjector.ts#L19)

Whether to allow injection when all parameters are undefined (defaults to false for safety)

***

### ignoreNonExistentColumns?

> `optional` **ignoreNonExistentColumns**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:21](https://github.com/mk3008/rawsql-ts/blob/5d06fb06f498f93eb4e681336982f83d09f58d21/packages/core/src/transformers/SqlParamInjector.ts#L21)

Whether to ignore non-existent columns instead of throwing errors (defaults to false for safety)
</div>
