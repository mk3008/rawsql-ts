---
layout: home

hero:
  name: DB Schema Docs
  text: Database schema documentation
  tagline: Generated automatically from DDL files
  actions:
    - theme: brand
      text: Browse Tables
      link: /tables/

features:
  - title: DDL-driven
    details: Place your .sql files in the ddl/ directory and documentation is generated automatically.
  - title: Always up to date
    details: Run npm run dev or npm run build to regenerate docs from the latest DDL.
  - title: Searchable
    details: Full-text search across all table and column documentation.
---

## Getting Started

1. Add your DDL files to the `ddl/` directory.
2. Run `npm run dev` to start the documentation site.

```bash
npm run dev
```

The `generate` step runs automatically before the dev server or build starts.
