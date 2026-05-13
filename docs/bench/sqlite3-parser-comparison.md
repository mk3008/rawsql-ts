# sqlite3-parser-js Style Benchmark Report

This report runs the sqlite3-parser-js-style input cases with `rawsql-ts` and `node-sql-parser` added for comparison.

## Command

```bash
pnpm --filter rawsql-ts run benchmark:sqlite3-parser
pnpm --filter rawsql-ts run benchmark:sqlite3-parser:bun
```

## Latest Run

```
benchmark.js v2.1.4, Windows_NT 10.0.26200
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
Node.js v22.14.0
Date 2026-05-13
Benchmark config: minSamples=10, maxTime=0.2s
Compared libraries: sqlite3-parser 0.7.1, rawsql-ts 0.20.0, node-sql-parser 5.4.0
```

The parser comparison is intentionally scoped to:

- `sqlite3-parser`, the SQLite-specific parser under investigation
- `rawsql-ts`, the project parser
- `node-sql-parser`, a well-known general-purpose JavaScript SQL parser

## Results

| Case | sqlite3-parser | rawsql-ts | node-sql-parser |
|------|---------------:|----------:|----------------:|
| tiny | 0.001 ms | 0.002 ms (2.1x slower) | 0.017 ms (16.1x slower) |
| small | 0.004 ms | 0.011 ms (2.4x slower) | 0.040 ms (9.0x slower) |
| medium | 0.030 ms | 0.113 ms (3.8x slower) | 0.538 ms (18.1x slower) |
| large (wide create table) | 0.121 ms | 0.238 ms (2.0x slower) | 0.763 ms (6.3x slower) |
| deep (nested expr + subquery) | 0.013 ms | 0.036 ms (2.9x slower) | 1.437 ms (113.7x slower) |

## Interpretation

`sqlite3-parser` is the fastest parser in these SQLite-shaped cases. That is the expected outcome for a focused SQLite parser.

The rawsql-ts result is still useful: rawsql-ts is consistently slower than the SQLite-specialized parser, but it remains much faster than `node-sql-parser` while preserving broader rawsql-ts features. This supports the project stance that rawsql-ts should not optimize away its multi-feature parser surface only to compete with a narrow SQLite parser on raw parse throughput.

## Bun / mitata Run

The Bun benchmark keeps the broader sqlite3-parser-js-style competitor set where npm packages are available.

```
mitata under Bun 1.3.14, Windows_NT 10.0.26200
AMD Ryzen 7 7800X3D 8-Core Processor, 16 logical cores
Date 2026-05-13
Compared libraries: sqlite3-parser 0.7.1, rawsql-ts 0.20.0, sqlite-parser 1.0.1, @appland/sql-parser 1.5.1, node-sql-parser 5.4.0, pgsql-ast-parser 12.0.2, @guanmingchiu/sqlparser-ts 0.61.1
```

| Case | sqlite3-parser | rawsql-ts | node-sql-parser |
|------|---------------:|----------:|----------------:|
| tiny | 2.02 us | 2.23 us | 26.31 us |
| small | 6.04 us | 15.01 us | 56.77 us |
| medium | 47.21 us | 176.94 us | 714.04 us |
| large (wide create table) | 135.64 us | 363.92 us | 1.25 ms |
| deep (nested expr + subquery) | 21.82 us | 36.45 us | 2.34 ms |

The Bun run matches the Node.js interpretation: `sqlite3-parser` wins the SQLite-specific throughput comparison, while rawsql-ts remains well ahead of `node-sql-parser`.

## Raw Artifacts

- Latest sqlite3-parser-js style Node report: `tmp/sqlite3-parser-benchmark-report-2026-05-13T13-46-16.525Z.md`
- Latest sqlite3-parser-js style Bun report: `tmp/sqlite3-parser-bun-benchmark-report-2026-05-13T13-51-11.397Z.md`
