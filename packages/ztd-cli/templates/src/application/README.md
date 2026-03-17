# Application

Use cases and orchestration live here.

- Coordinate domain behavior and repository ports here.
- Avoid direct ownership of SQL, DDL, and ZTD configuration in this layer.
- When you need a repository-test example, start from `tests/queryspec.example.test.ts` and keep the application layer free of SQL.
