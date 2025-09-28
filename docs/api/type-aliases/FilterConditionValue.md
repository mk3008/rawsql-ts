<div v-pre>
# Type Alias: FilterConditionValue

> **FilterConditionValue** = [`SqlParameterValue`](SqlParameterValue.md) \| [`SqlParameterValue`](SqlParameterValue.md)[] \| \{ `min?`: [`SqlParameterValue`](SqlParameterValue.md); `max?`: [`SqlParameterValue`](SqlParameterValue.md); `like?`: `string`; `ilike?`: `string`; `in?`: [`SqlParameterValue`](SqlParameterValue.md)[]; `any?`: [`SqlParameterValue`](SqlParameterValue.md)[]; `=?`: [`SqlParameterValue`](SqlParameterValue.md); `>?`: [`SqlParameterValue`](SqlParameterValue.md); `<?`: [`SqlParameterValue`](SqlParameterValue.md); `>=?`: [`SqlParameterValue`](SqlParameterValue.md); `<=?`: [`SqlParameterValue`](SqlParameterValue.md); `!=?`: [`SqlParameterValue`](SqlParameterValue.md); `<>?`: [`SqlParameterValue`](SqlParameterValue.md); `or?`: `object`[]; `and?`: `object`[]; `column?`: `string`; \}

Defined in: [packages/core/src/transformers/DynamicQueryBuilder.ts:24](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/DynamicQueryBuilder.ts#L24)

Value union accepted for a single filter entry in DynamicQueryBuilder.

## Example

```typescript
const options = { filter: { price: { min: 10, max: 100 }, status: ['active', 'pending'] } };
builder.buildQuery('SELECT * FROM orders', options);
```
Related tests: packages/core/tests/transformers/DynamicQueryBuilder.test.ts
</div>
