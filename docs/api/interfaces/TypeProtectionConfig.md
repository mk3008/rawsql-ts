<div v-pre>
# Interface: TypeProtectionConfig

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:55](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/EnhancedJsonMapping.ts#L55)

Type protection configuration.

## Properties

### protectedStringFields

> **protectedStringFields**: `string`[]

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:57](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/EnhancedJsonMapping.ts#L57)

Columns that should be treated as strings

***

### dateFields?

> `optional` **dateFields**: `string`[]

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:59](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/EnhancedJsonMapping.ts#L59)

Columns that should be parsed as dates

***

### numberFields?

> `optional` **numberFields**: `string`[]

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:61](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/EnhancedJsonMapping.ts#L61)

Columns that should be parsed as numbers

***

### customTransforms?

> `optional` **customTransforms**: `Record`&lt;`string`, `string`\&gt;

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:63](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/EnhancedJsonMapping.ts#L63)

Custom type transformations
</div>
