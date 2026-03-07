<div v-pre>
# Interface: CTEOptions

Defined in: [packages/core/src/models/SelectQuery.ts:23](https://github.com/mk3008/rawsql-ts/blob/fffd661d21a357a361d2a4534bd85e1192a0bdcf/packages/core/src/models/SelectQuery.ts#L23)

Options that control how a Common Table Expression is materialized when the query is executed.

## Example

```typescript
const mainQuery = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
const cte = SelectQueryParser.parse('SELECT id FROM accounts WHERE active = true');

mainQuery.addCTE('active_accounts', cte, { materialized: true });
```
Related tests: packages/core/tests/models/SelectQuery.cte-management.test.ts

## Properties

### materialized?

> `optional` **materialized**: `null` \| `boolean`

Defined in: [packages/core/src/models/SelectQuery.ts:24](https://github.com/mk3008/rawsql-ts/blob/fffd661d21a357a361d2a4534bd85e1192a0bdcf/packages/core/src/models/SelectQuery.ts#L24)
</div>
