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
Compared library: node-sql-parser 5.4.0
```

Line counts are included for readability, while token counts remain the more exact technical reference. Parser cost is driven more directly by token volume than by formatting style.

The mid-large and very large cases use benchmark-only analytics-style SQL workloads that approximate practical long-query classes. The current fixtures are about 531 lines / 4,893 tokens and 1,203 lines / 11,529 tokens respectively.

#### Small query, about 8 lines (70 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.040 |  0.0136 |  0.0069 |                - |
| node-sql-parser                |    0.687 |  0.3009 |  0.1535 |            17.0x |

#### Medium query, about 12 lines (140 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.080 |  0.0461 |  0.0235 |                - |
| node-sql-parser                |    0.744 |  0.2732 |  0.1394 |             9.3x |

#### Large query, about 20 lines (230 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.168 |  0.0242 |  0.0124 |                - |
| node-sql-parser                |    1.560 |  0.4159 |  0.2122 |             9.3x |

#### Mid-large query, about 400-500 lines (5,000 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    4.438 |  1.6794 |  0.8568 |                - |
| node-sql-parser                |   36.520 | 21.5072 | 10.9730 |             8.2x |

#### Very large query, about 1,000+ lines (~12,000 tokens)
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    8.173 |  4.3703 |  2.2298 |                - |
| node-sql-parser                |   54.775 |  4.9455 |  2.5232 |             6.7x |

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
      "data": [0.04, 0.08, 0.168, 4.438, 8.173],
      "borderColor": "rgba(54,162,235,1)",
      "backgroundColor": "rgba(54,162,235,0.15)",
      "fill": false,
      "tension": 0.2
    },
    {
      "label": "node-sql-parser",
      "data": [0.687, 0.744, 1.56, 36.52, 54.775],
      "borderColor": "rgba(255,206,86,1)",
      "backgroundColor": "rgba(255,206,86,0.15)",
      "fill": false,
      "tension": 0.2
    }
  ]
}
```

## Raw Artifacts

- Latest report: `tmp/parse-benchmark-report-2026-03-06T00-22-54.135Z.md`
