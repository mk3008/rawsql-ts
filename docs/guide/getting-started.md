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

const baseSql = 'SELECT id, name, email, created_at FROM users WHERE active = true';

const builder = new DynamicQueryBuilder();
const query = builder.buildQuery(baseSql, {
  filter: { status: 'premium', created_at: { '>': '2024-01-01' } },
  sort: { created_at: { desc: true }, name: { asc: true } },
  paging: { page: 2, pageSize: 10 }
});

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);

console.log(formattedSql);
console.log(params);
```

## Next Step

- [Formatting Recipes](./formatting-recipes.md) - Configure whitespace, keyword casing, and placeholder styles so your formatted SQL matches production expectations.
- [Querybuilding Recipes](./querybuilding-recipes.md) - Master `FilterConditions`, nested logic, and downstream formatting to safely project runtime parameters.
