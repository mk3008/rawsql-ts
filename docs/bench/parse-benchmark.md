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
Date 2026-03-05
Benchmark config: default minSamples=10, maxTime=0.2s; heavy minSamples=6, maxTime=0.12s
```

Line counts are included for readability, while token counts remain the more exact technical reference. Parser cost is driven more directly by token volume than by formatting style.

The very large case uses a benchmark-only analytics-style SQL workload of about 1,200 lines and 11,500 tokens, presented in the README as the reader-friendly `~12,000 token / 1,000+ line` class.

#### Small query, about 8 lines (70 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.045 |  0.0140 |  0.0071 |                - |
| node-sql-parser                |    0.448 |  0.2268 |  0.1157 |             9.9x |

#### Medium query, about 12 lines (140 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.141 |  0.0635 |  0.0324 |                - |
| node-sql-parser                |    0.868 |  0.7486 |  0.3819 |             6.1x |

#### Large query, about 20 lines (230 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.138 |  0.0207 |  0.0105 |                - |
| node-sql-parser                |    1.660 |  0.4995 |  0.2548 |            12.0x |

#### Very large query, about 1,000+ lines (~12,000 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    8.720 |  1.7075 |  0.8712 |                - |
| node-sql-parser                |   92.965 | 51.0052 | 26.0230 |            10.7x |

## Chart Dataset

```json
{
  "labels": [
    "Small",
    "Medium",
    "Large",
    "Very large"
  ],
  "datasets": [
    {
      "label": "rawsql-ts",
      "data": [0.045, 0.141, 0.138, 8.72]
    },
    {
      "label": "node-sql-parser",
      "data": [0.448, 0.868, 1.66, 92.965]
    }
  ]
}
```

## Raw Artifacts

- Latest report: `tmp/parse-benchmark-report-2026-03-05T23-49-00.686Z.md`
