# ID Search Benchmark Report (benchmark.js)

**Generated on:** 2025-06-03T00:33:08.598Z

**Library:** benchmark.js

**Test Focus:** Single Record Retrieval Performance Analysis

## 💻 System Information

```
Windows_NT 10.0.26100
AMD Ryzen 7 7800X3D 8-Core Processor           , 16 logical cores
Node.js v22.14.0, 31GB RAM
```

## 📊 Benchmark Results

### ID 1 Performance Breakdown

#### rawsql-ts Components

| Component | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| SQL Generation | 0.272 | ±0.013 | 0.113 |
| SQL Execution | 1.112 | ±0.044 | 0.381 |
| **Total Time** | **1.384** | **±0.042** | **0.364** |

#### Library Comparison

| Library | Mean (ms) | Error (ms) | StdDev (ms) | Speedup |
|---------|-----------|------------|-------------|----------|
| rawsql-ts | 1.384 | ±0.042 | 0.364 | - |
| Prisma | 1.985 | ±0.019 | 0.167 | 1.4x slower |

### ID 10 Performance Breakdown

#### rawsql-ts Components

| Component | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| SQL Generation | 0.268 | ±0.014 | 0.128 |
| SQL Execution | 1.021 | ±0.027 | 0.240 |
| **Total Time** | **1.289** | **±0.023** | **0.202** |

#### Library Comparison

| Library | Mean (ms) | Error (ms) | StdDev (ms) | Speedup |
|---------|-----------|------------|-------------|----------|
| rawsql-ts | 1.289 | ±0.023 | 0.202 | - |
| Prisma | 1.980 | ±0.078 | 0.678 | 1.5x slower |

## 🔍 Overall Analysis

**Performance Summary (Average across 2 tests):**

- **SQL Generation**: 0.270ms (20.2% of total time)
- **SQL Execution**: 1.066ms (79.8% of total time)
- **rawsql-ts Total**: 1.336ms
- **Prisma Total**: 1.982ms
- **Overall Speedup**: 1.5x (rawsql-ts is 1.5 times faster)

## 📈 Key Insights

1. **Statistical Accuracy**: Using Mean, Error (±), and Standard Deviation for precise measurements
2. **Clear Structure**: SQL Generation + SQL Execution = Total Time breakdown
3. **Library Used**: benchmark.js for industry-standard statistical accuracy
4. **Error Calculation**: Error margins calculated from benchmark.js relative margin of error (RME)
5. **Test Focus**: Focused on essential metrics without redundant tests

