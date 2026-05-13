# Parse Benchmark Report

This report tracks the parse-only SQL parser benchmark referenced from `packages/core/README.md`.

## Command

```bash
pnpm --filter rawsql-ts run benchmark
```

## Latest Run

```
benchmark.js v2.1.4, Windows_NT 10.0.26200
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
Node.js v22.14.0
Date 2026-05-13
Benchmark config: default minSamples=10, maxTime=0.2s; heavy minSamples=6, maxTime=0.12s
Compared libraries: node-sql-parser 5.4.0, sqlite3-parser 0.7.1
```

Line counts are included for readability, while token counts remain the more exact technical reference. Parser cost is driven more directly by token volume than by formatting style.

The mid-large and very large cases use benchmark-only analytics-style SQL workloads that approximate practical long-query classes. `sqlite3-parser` is SQLite-specific, so it does not run the PostgreSQL-style typed literal cases that contain `DATE '2024-01-01'`.

## Results

| Workload | rawsql-ts | node-sql-parser | sqlite3-parser |
|----------|----------:|----------------:|----------------:|
| Small query, about 8 lines (70 tokens) | 0.053 ms | 0.646 ms (12.2x slower) | 0.015 ms |
| Medium query, about 12 lines (140 tokens) | 0.094 ms | 0.874 ms (9.3x slower) | 0.026 ms |
| Large query, about 20 lines (230 tokens) | 0.175 ms | 1.954 ms (11.2x slower) | 0.062 ms |
| Mid-large query, about 400-500 lines (5,000 tokens) | 4.462 ms | 31.672 ms (7.1x slower) | n/a |
| Very large query, about 1,000+ lines (~12,000 tokens) | 9.715 ms | 79.583 ms (8.2x slower) | n/a |

## Interpretation

`sqlite3-parser` is faster on SQLite-compatible inputs, which is expected for a SQLite-focused generated parser. `rawsql-ts` is not trying to win that narrow parse-speed contest; it carries a broader AST model, PostgreSQL-oriented syntax support, comments, source-position metadata, formatting support, and downstream transformation features.

The useful benchmark finding is that rawsql-ts remains within practical parse-only latency for these workloads and is consistently faster than the well-known `node-sql-parser` baseline in this setup.

## Deferred Runtime Profile Prototype

During this investigation, a prototype option that skipped comment preservation and source-position attachment was tested but not adopted. The prototype was exposed in benchmark output as `rawsql-ts/runtime`.

Observed improvement in the rawsql-ts benchmark was approximately:

| Workload | default | prototype | improvement |
|----------|--------:|----------:|------------:|
| Small 70 tokens | 0.057 ms | 0.047 ms | about 18% |
| Medium 140 tokens | 0.104 ms | 0.089 ms | about 14% |
| Large 230 tokens | 0.182 ms | 0.158 ms | about 13% |
| 5,000 tokens | 4.255 ms | 4.085 ms | about 4% |
| 12,000 tokens | 9.404 ms | 8.602 ms | about 9% |

The prototype was not merged because the speedup does not justify the additional public API surface and maintenance cost. It also risks confusing callers: disabling comments and position metadata is useful for some trusted runtime parsing paths, but it is the wrong behavior for formatting, comment editing, diagnostics, and source mapping. Keeping the default parser behavior unchanged is the safer tradeoff.

## Raw Artifacts

- Latest rawsql-ts benchmark report: `tmp/parse-benchmark-report-2026-05-13T13-45-50.424Z.md`
