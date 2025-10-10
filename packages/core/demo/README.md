# Complex SQL Formatting Demo Application

## Overview

Demo application for regression testing, designed for continuous verification of positioned comments system and SQL formatting quality.

## Usage

```bash
npm run demo:complex-sql
```

## Features

### 🎯 Main Verification Items

- **WITH Clauses**: Complex CTE (Common Table Expression) processing
- **JOIN Clauses**: INNER JOIN, LEFT JOIN formatting
- **Subqueries**: Nested subquery processing
- **WINDOW Functions**: Window functions like ROW_NUMBER, SUM, AVG
- **CASE Expressions**: Complex CASE WHEN expression formatting
- **Aggregate Functions**: COUNT, SUM, AVG, PERCENTILE_CONT, etc.
- **Comments**: positioned comments system behavior verification

### 📊 Measurement Metrics

- **Performance**: Parse time and format time measurement
- **Quality Metrics**: Line count changes and syntax validity verification
- **Comment Analysis**: Preservation rate, lost comments, duplicate comments analysis

### 🔧 Formatting Styles

1. **Before Comma Style** (`commaBreak: 'before'`)
2. **After Comma Style** (`commaBreak: 'after'`)
3. **Optimized Style** (compact configuration)
4. **OR Break Variants** (`orBreak: 'before' | 'after'`) for highlighting vertical OR chains

## SQL Samples

### 1. sales_analysis
- 169-line super complex CTE sales analysis SQL
- 6 CTEs, 4 JOINs, 7 subqueries
- 5 WINDOW functions, 75 comments

### 2. qualified_name_test
- SQL for QualifiedName splitting bug verification
- Verification of `u.name /* comment */` format preservation

### 3. case_expression_test
- CASE expression comment order verification
- Complex pattern testing for positioned comments

## Reports

After execution, detailed Markdown reports are generated at:
```
packages/core/reports/sql-demo-report-TIMESTAMP.md
```

### Report Contents

- Execution summary (quality metrics by SQL sample)
- Detailed results (performance and quality analysis by configuration)
- Comment analysis (details of lost and duplicated comments)
- Formatted SQL samples
- Recommendations

## Usage for Regression Testing

### 1. Baseline Establishment
Run demo before new feature development and record quality metrics:
```bash
npm run demo:complex-sql
# → Save quality metrics from report as baseline
```

### 2. Post-Change Verification
Re-run after feature changes to detect quality degradation:
```bash
npm run demo:complex-sql
# → Compare with previous report to check for regressions
```

### 3. Continuous Verification
Can be integrated into CI/CD pipeline for automatic execution

## Quality Standards

### 🎯 Target Metrics

- **Comment Preservation Rate**: Maintain 95% or higher
- **Syntax Validity**: 100% (reparse success rate)
- **CTE Count Consistency**: 100% (same CTE count as original SQL)
- **Performance**: Under 50ms for large SQL (169 lines)

### ⚠️ Metrics to Watch

- **Lost Comments**: Watch for comment loss in WINDOW functions
- **Duplicated Comments**: Side effects of positioned comments system
- **CASE Expression Comment Order**: Comment confusion in complex CASE expressions

## Extension Methods

Add new SQL pattern test cases:

```javascript
// Add to COMPLEX_SQL_SAMPLES in complex-sql-demo.js
const COMPLEX_SQL_SAMPLES = {
    // Existing samples...

    new_pattern_test: `
        -- New pattern SQL
        SELECT * FROM test_table
    `
};
```

## Troubleshooting

### Module Loading Error
```bash
npm run build:core  # Regenerate dist directory
```

### Report Generation Failure
- Check write permissions for `packages/core/reports/` directory
- Check disk space

## Related Files

- `complex-sql-demo.js` - Main application
- `../reports/` - Generated reports
- `../../package.json` - npm scripts definition
- `../dist/` - Built modules
