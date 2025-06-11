# prisma-rawsql

Prisma integration for rawsql-ts - Dynamic SQL generation with type safety and hierarchical JSON serialization.

## Features

- 🔄 **Dynamic SQL Generation**: Build complex queries dynamically using Prisma schema metadata
- 🛡️ **Type Safety**: Full TypeScript support with Prisma-generated types
- 📊 **Hierarchical JSON**: Transform flat SQL results into nested JSON structures
- ⚡ **Performance**: Optimized SQL generation and execution
- 🔧 **Parameter Injection**: Safe SQL parameter handling
- 📈 **Sorting & Pagination**: Built-in support for data sorting and pagination

## Installation

```bash
npm install prisma-rawsql
```

## Quick Start

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaRawSql } from 'prisma-rawsql';

const prisma = new PrismaClient();
const rawSql = new PrismaRawSql(prisma);

// Dynamic query building with type safety
const result = await rawSql
  .select('users')
  .include(['profile', 'posts'])
  .where({ active: true })
  .orderBy('createdAt', 'desc')
  .paginate(1, 20)
  .executeAsJson();
```

## Documentation

For detailed documentation and examples, visit: [https://mk3008.github.io/rawsql-ts/](https://mk3008.github.io/rawsql-ts/)

## License

MIT
