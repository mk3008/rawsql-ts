# Infrastructure

Infrastructure adapters live here.

- Database, telemetry, and persistence integration belong here.
- Keep domain and application contracts stable while swapping implementations.
- The default repository telemetry seam is no-op, so you can leave it wired but silent until you opt in to a sink.
- Use `queryId` as the stable lookup key and treat `repositoryName` and `methodName` as human-readable hints.
- Use `tests/queryspec.example.test.ts` as the first repository-oriented sample when you add a persistence seam.
