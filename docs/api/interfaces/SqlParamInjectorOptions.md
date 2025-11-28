<div v-pre>
# Interface: SqlParamInjectorOptions

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:12](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SqlParamInjector.ts#L12)

Options for SqlParamInjector

## Properties

### ignoreCaseAndUnderscore?

> `optional` **ignoreCaseAndUnderscore**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:14](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SqlParamInjector.ts#L14)

Whether to ignore case and underscore differences when matching column names

***

### allowAllUndefined?

> `optional` **allowAllUndefined**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:16](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SqlParamInjector.ts#L16)

Whether to allow injection when all parameters are undefined (defaults to false for safety)

***

### ignoreNonExistentColumns?

> `optional` **ignoreNonExistentColumns**: `boolean`

Defined in: [packages/core/src/transformers/SqlParamInjector.ts:18](https://github.com/mk3008/rawsql-ts/blob/1a1d14ee3824180691b24e85de0d461b902114ea/packages/core/src/transformers/SqlParamInjector.ts#L18)

Whether to ignore non-existent columns instead of throwing errors (defaults to false for safety)
</div>
