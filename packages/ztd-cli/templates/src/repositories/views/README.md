# View Repositories

Read-only repositories backed by SELECT SQL in `src/sql`.

Accept an optional telemetry hook from `src/infrastructure/telemetry/repositoryTelemetry.ts` and default it through `resolveRepositoryTelemetry(...)` so applications can bridge structured events into their own logging stack.
