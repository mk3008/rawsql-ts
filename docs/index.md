---
layout: home
hero:
  name: rawsql-ts
  text: TypeScript-native SQL parser and transformer
  tagline: High-performance SQL parsing and transformation — all starting from your existing SQL.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/overview
    - theme: alt
      text: View API Docs
      link: /api/index
    - theme: alt
      text: Open Playground
      link: /demo/index.html
      target: _blank
      rel: noopener
features:
  - title: Zero Dependency
    details: Fully self-contained and lightweight. Works in Node.js and browsers without external packages.
  - title: High-performance SQL Parsing
    details: 3–8× faster than major SQL libraries while supporting complex PostgreSQL queries.
  - title: Transform Existing SQL
    details: Parse raw SQL into AST, apply dynamic filters and structural transformations, then regenerate optimized queries.
  - title: Browser & Playground Ready
    details: Run in the browser via CDN and experiment with live formatting and analysis tools.
---

## Quick Start

Install the package and build your first dynamic query:

```bash
npm install rawsql-ts
```

### Your First Dynamic Query

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
