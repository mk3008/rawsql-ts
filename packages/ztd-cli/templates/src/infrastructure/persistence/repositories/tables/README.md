# Table Repositories

Write-focused repositories that execute CRUD SQL from `src/sql`.

Accept an optional telemetry hook from `src/infrastructure/telemetry/repositoryTelemetry.ts` and default it through `resolveRepositoryTelemetry(...)` so applications can replace the sink without editing repository internals.
- When you add the first table repository test, start from `tests/queryspec.example.test.ts` so the QuerySpec, mapping, and repository seam stay aligned.
