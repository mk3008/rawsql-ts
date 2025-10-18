---
title: Overview
outline: deep
---
# Overview

`rawsql-ts` is a **TypeScript-native, zero-dependency SQL parser and transformer** designed for high performance and real-world workflows.
Instead of relying on complex DSL builders, `rawsql-ts` starts from your existing SQL, parses it into an AST, and lets you programmatically analyze, transform, and regenerate optimized queries.

It is lightweight, fast, and built to keep your SQL expressive and reusable, not buried in code.

---

## Key Features

- **Start from SQL, not DSL** - Parse existing SQL into an AST and manipulate it with functions, not chained builders.
- **High performance** - Up to 3-8x faster than popular SQL parsers, even with complex PostgreSQL queries.
- **Dynamic query manipulation** - Easily inject filters, sorting, and pagination, or transform structures for advanced workflows.
- **Zero dependencies** - Works in Node.js and browsers via CDN, no external packages required.
- **TypeScript-first** - Full type coverage and API reference generated automatically from the source.

## Repository Structure

- packages/core/src - Core TypeScript source, exported via index.ts.
- docs/ - VitePress documentation site, including auto-generated API under docs/api.
- .github/workflows - CI pipelines for docs generation and deployment.

## Parsing Entry Point

`SqlParser` is the canonical gateway for turning raw SQL into AST objects. Today it delegates to `SelectQueryParser` for SELECT/VALUES statements and will fan out to INSERT/UPDATE/DDL parsers as they land.

```typescript
import { SqlParser } from 'rawsql-ts';

const statement = SqlParser.parse('SELECT id, email FROM users');
const statements = SqlParser.parseMany(`
    SELECT id FROM users WHERE active = true;
    SELECT id FROM accounts WHERE suspended = false;
`);
```

`SelectQueryParser` stays available when you explicitly need SELECT-only semantics, but new capabilities will surface through `SqlParser`.

## Next Steps

- Follow the Getting Started Guide for local usage and formatting recipes.
- Try the Formatter Playground to experiment with formatting and AST analysis.
- Browse the API Reference for detailed class and type definitions.
