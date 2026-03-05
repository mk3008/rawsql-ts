# Parse Benchmark Report

This report tracks the parser-only comparison shown in `packages/core/README.md`.

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

#### Tokens70
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.092 |  0.0301 |  0.0154 |                - |
| node-sql-parser                |    0.604 |  0.6503 |  0.3318 |             6.6x |

#### Tokens140
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.152 |  0.0506 |  0.0258 |                - |
| node-sql-parser                |    1.212 |  0.6133 |  0.3129 |             8.0x |

#### Tokens230
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |    0.282 |  0.2075 |  0.1059 |                - |
| node-sql-parser                |    1.628 |  0.4091 |  0.2087 |             5.8x |

#### Tokens12000
| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |
|---------------------------------- |-----------:|----------:|----------:|--------------------------:|
| rawsql-ts                      |   15.969 |  1.2389 |  0.6321 |                - |
| node-sql-parser                |   52.814 |  4.6718 |  2.3836 |             3.3x |

## Chart Dataset

```json
{
  "labels": [
    "Tokens70",
    "Tokens140",
    "Tokens230",
    "Tokens12000"
  ],
  "datasets": [
    {
      "label": "rawsql-ts",
      "data": [0.092, 0.152, 0.282, 15.969]
    },
    {
      "label": "node-sql-parser",
      "data": [0.604, 1.212, 1.628, 52.814]
    }
  ]
}
```

## Raw Artifacts

- Latest report: `tmp/parse-benchmark-report-2026-03-05T13-37-11.015Z.md`
