---
title: Getting Started
outline: deep
---

# Getting Started

## Prerequisites

- Node.js 20 or later (aligns with the CI matrix)
- npm >= 10.0 (ships with Node 20)

## Install

```bash
npm install rawsql-ts
```

## Your First Dynamic Query

```typescript
import { DynamicQueryBuilder, SqlFormatter } from 'rawsql-ts';

const baseSql = `
  SELECT id, name, email, status, created_at
  FROM users
  WHERE active = true
    AND (:status IS NULL OR status = :status)
`;

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: { status: 'premium' },
  sort: { created_at: { desc: true }, name: { asc: true } },
  paging: { page: 2, pageSize: 10 },
  optionalConditionParameters: { status: 'premium' }
});

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);

console.log(formattedSql);
console.log(params);
```

## Next Step

- [Formatting Recipes](./formatting-recipes.md) - Configure whitespace, keyword casing, and placeholder styles so your formatted SQL matches production expectations.
- [Querybuilding Recipes](./querybuilding-recipes.md) - Master `FilterConditions`, nested logic, and downstream formatting to safely project runtime parameters.
- [Execution Scope](./execution-scope.md) - Learn what stays caller-owned for connections and transactions, and when to use the optional [`@rawsql-ts/executor`](https://github.com/mk3008/rawsql-ts/blob/main/packages/executor/README.md) helper to reduce boilerplate.
