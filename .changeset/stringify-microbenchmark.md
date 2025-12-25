---
"@rawsql-ts/ztd-cli": patch
---

## AST stringify microbenchmark

- Added a standalone TypeScript script that parses the existing repository SQL to AST and measures the stringify step (`SqlFormatter.format`) in μs/ ns loops.
- Documented how to run the script with `pnpm ts-node benchmarks/ztd-bench/stringify-only-benchmark.ts` and how to tune warmup/iteration counts.
