# rawsql-ts Startup Cost Report

Status: initial measurement complete. This report is separate from steady-state Pure ORM performance.

## Purpose

Steady-state Pure ORM benchmarks measure hot query execution and mapper cost. Startup SQL parsing and catalog preparation are not in that hot path, but they still matter for cold start, serverless deployments, and applications with many query assets.

This report keeps startup cost separate so runtime optimization decisions do not accidentally remove dynamic SQL support or SSSQL/pipeline capabilities.

## Measured Phases

Command:

```sh
pnpm bench:startup-cost -- --runs=20 --folder=results-startup-cost-20260503
```

Artifact:

- `benchmarks/drizzle-official-comparison/results-startup-cost-20260503/startup-cost-summary.json`

| phase | runs | mean | p50 | p95 | min | max |
|---|---:|---:|---:|---:|---:|---:|
| SQL file load | 20 | 0.5299ms | 0.4854ms | 0.7122ms | 0.4640ms | 0.7446ms |
| rawsql parser import | 20 | 0.5927ms | 0.4354ms | 0.6634ms | 0.4043ms | 3.1543ms |
| SQL parse | 20 | 1.9829ms | 0.9597ms | 3.6801ms | 0.7747ms | 15.8635ms |
| catalog preparation | 20 | 3.1275ms | 2.5951ms | 6.2019ms | 2.0066ms | 6.3999ms |
| generated mapper import | 20 | 1.9104ms | 1.2311ms | 3.7804ms | 0.9332ms | 4.6435ms |

## Interpretation

- Startup parse/catalog work is measurable but separate from steady-state query execution.
- Dynamic-condition support, SSSQL rewriting, and pipeline features should not be removed to optimize steady-state mapper performance.
- A future no-parse/static descriptor path should be justified as cold-start or serverless work, not as a hot-path Pure ORM optimization.

## Future Candidates

- static query descriptor generation
- no-parse catalog mode for queries with no dynamic conditions
- generated query descriptor import
- larger startup benchmark suites with many SQL files
- comparison between dynamic-capable catalog loading and static generated descriptors
