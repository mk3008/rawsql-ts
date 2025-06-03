# List Search Performance Benchmark Report

**Generated:** 2025-06-03T10:31:05.085Z
**Test Type:** List Search Operations (findByCriteria)
**Library:** rawsql-ts vs Prisma ORM
**Database:** PostgreSQL

---

## System Information

| Property | Value |
|----------|-------|
| **OS** | win32 10.0.26100 |
| **Architecture** | x64 |
| **CPU** | AMD Ryzen 7 7800X3D 8-Core Processor            |
| **CPU Cores** | 16 |
| **Total Memory** | 31 GB |
| **Free Memory** | 17 GB |
| **Node.js Version** | v22.14.0 |

---

## Detailed Performance Results

### Simple Status Filter

**Search Criteria:**
```json
{
  "status": "in_progress"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Simple Status Filter) | 0.179 | 0.008 | 0.004 |
| rawsql-ts Total (Simple Status Filter) | 1.051 | 0.018 | 0.009 |
| Prisma Total (Simple Status Filter) | 1.399 | 0.024 | 0.012 |

### Priority + Status Filter

**Search Criteria:**
```json
{
  "status": "pending",
  "priority": "high"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Priority + Status Filter) | 0.200 | 0.004 | 0.002 |
| rawsql-ts Total (Priority + Status Filter) | 1.065 | 0.021 | 0.011 |
| Prisma Total (Priority + Status Filter) | 1.382 | 0.022 | 0.011 |

### Title Search

**Search Criteria:**
```json
{
  "title": "test"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Title Search) | 0.169 | 0.004 | 0.002 |
| rawsql-ts Total (Title Search) | 0.960 | 0.017 | 0.009 |
| Prisma Total (Title Search) | 0.785 | 0.010 | 0.005 |

### Category Color Filter

**Search Criteria:**
```json
{
  "categoryColor": "#3498db"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Category Color Filter) | 0.166 | 0.004 | 0.002 |
| rawsql-ts Total (Category Color Filter) | 1.057 | 0.018 | 0.009 |
| Prisma Total (Category Color Filter) | 1.460 | 0.022 | 0.011 |

### Complex Multi-filter

**Search Criteria:**
```json
{
  "status": "in_progress",
  "priority": "medium",
  "title": "important",
  "categoryName": "work"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Complex Multi-filter) | 0.237 | 0.007 | 0.004 |
| rawsql-ts Total (Complex Multi-filter) | 1.040 | 0.015 | 0.008 |
| Prisma Total (Complex Multi-filter) | 0.861 | 0.015 | 0.007 |

### Date Range Filter

**Search Criteria:**
```json
{
  "fromDate": "2024-01-01T00:00:00.000Z",
  "toDate": "2024-12-31T00:00:00.000Z"
}
```

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
| rawsql-ts Generation (Date Range Filter) | 0.175 | 0.006 | 0.003 |
| rawsql-ts Total (Date Range Filter) | 0.981 | 0.013 | 0.006 |
| Prisma Total (Date Range Filter) | 0.815 | 0.028 | 0.014 |

---

## Summary Analysis

### Performance Comparison by Operation Type

| Test Case | rawsql-ts Generation (ms) | rawsql-ts Total (ms) | Prisma Total (ms) | Generation Overhead (%) |
|-----------|---------------------------|----------------------|-------------------|------------------------|
| Simple Status Filter | 0.179 | 1.051 | 1.399 | 17.1% |
| Priority + Status Filter | 0.200 | 1.065 | 1.382 | 18.8% |
| Title Search | 0.169 | 0.960 | 0.785 | 17.6% |
| Category Color Filter | 0.166 | 1.057 | 1.460 | 15.7% |
| Complex Multi-filter | 0.237 | 1.040 | 0.861 | 22.8% |
| Date Range Filter | 0.175 | 0.981 | 0.815 | 17.9% |

### Overall Performance Metrics

| Metric | Value |
|--------|-------|
| **Average SQL Generation Time** | 0.188 ms |
| **Average rawsql-ts Total Time** | 1.026 ms |
| **Average Prisma Total Time** | 1.117 ms |
| **Performance Gain vs Prisma** | 8.2% |
| **SQL Generation Overhead** | 18.3% |

---

## Key Insights

### rawsql-ts Component Performance Analysis
- **SQL Generation:** Isolated measurement of query building and formatting performance
- **Total Operation:** Complete execution including database round-trip and result processing
- **Generation Overhead:** Percentage of total time spent on SQL generation vs database execution

### Performance Characteristics by Search Pattern
- **Simple Filters:** Basic status/priority filtering performance baseline
- **Text Search:** Impact of LIKE operations on query performance
- **Multi-criteria:** Complex filtering with multiple conditions
- **Date Ranges:** Temporal filtering performance characteristics

### Statistical Accuracy
- **Error Calculation:** Derived from Relative Margin of Error (RME) with 95% confidence
- **Standard Deviation:** Estimated from error margins to show result consistency
- **Mean Values:** Average execution time per operation across multiple iterations

### Technology Comparison
- **rawsql-ts Advantages:** Direct SQL control, predictable performance, minimal overhead
- **Prisma Considerations:** ORM abstraction layer, query optimization, type safety trade-offs
- **Use Case Optimization:** Performance characteristics vary by search complexity

*This benchmark provides insights into list search performance patterns to guide architectural decisions.*
