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
Date 2026-03-06
Benchmark config: default minSamples=10, maxTime=0.2s; heavy minSamples=6, maxTime=0.12s
Compared library: node-sql-parser 5.3.12
```

Line counts are included for readability, while token counts remain the more exact technical reference. Parser cost is driven more directly by token volume than by formatting style.

The mid-large and very large cases use benchmark-only analytics-style SQL workloads that approximate practical long-query classes. The current fixtures are about 531 lines / 4,893 tokens and 1,203 lines / 11,529 tokens respectively.

#### Small query, about 8 lines (70 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.082 |  0.0422 |  0.0215 |                - |
| node-sql-parser                |    0.634 |  0.5918 |  0.3019 |             7.8x |

#### Medium query, about 12 lines (140 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.086 |  0.0193 |  0.0099 |                - |
| node-sql-parser                |    0.742 |  0.2622 |  0.1338 |             8.6x |

#### Large query, about 20 lines (230 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.148 |  0.0830 |  0.0423 |                - |
| node-sql-parser                |    2.505 |  1.3977 |  0.7131 |            17.0x |

#### Mid-large query, about 400-500 lines (5,000 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    3.995 |  3.0294 |  1.5456 |                - |
| node-sql-parser                |   23.490 |  3.3085 |  1.6880 |             5.9x |

#### Very large query, about 1,000+ lines (~12,000 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    7.746 |  1.1801 |  0.6021 |                - |
| node-sql-parser                |   67.917 | 41.4928 | 21.1698 |             8.8x |

## Chart Dataset

```json
{
  "labels": [
    "Small 8 lines",
    "Medium 12 lines",
    "Large 20 lines",
    "Mid-large 400-500 lines",
    "Very large 1,000+ lines"
  ],
  "datasets": [
    {
      "label": "rawsql-ts",
      "data": [0.082, 0.086, 0.148, 3.995, 7.746],
      "borderColor": "rgba(54,162,235,1)",
      "backgroundColor": "rgba(54,162,235,0.15)",
      "fill": false,
      "tension": 0.2
    },
    {
      "label": "node-sql-parser",
      "data": [0.634, 0.742, 2.505, 23.49, 67.917],
      "borderColor": "rgba(255,206,86,1)",
      "backgroundColor": "rgba(255,206,86,0.15)",
      "fill": false,
      "tension": 0.2
    }
  ]
}
```

## Raw Artifacts

- Latest report: `tmp/parse-benchmark-report-2026-03-06T00-12-40.088Z.md`
