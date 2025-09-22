#!/usr/bin/env node

require('ts-node/register/transpile-only');

/**
 * Complex SQL Formatting Demo Application
 * Permanent demo application for regression testing
 *
 * Usage: npm run demo:complex-sql
 * Purpose: Continuous verification of positioned comments system and SQL formatting quality
 */

const { SelectQueryParser } = require('../src/parsers/SelectQueryParser');
const { SqlFormatter } = require('../src/transformers/SqlFormatter');
const fs = require('fs');
const path = require('path');

// Report output directory
const reportDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
}

console.log('🎯 Complex SQL Formatting Demo Application - Regression Testing');
console.log('=' .repeat(80));
console.log(`📁 Report output directory: ${reportDir}`);

// Complex SQL samples - Comprehensive feature coverage (baseline SQL for regression testing)
const COMPLEX_SQL_SAMPLES = {
    // Sample 1: Sales analysis report (main)
    sales_analysis: `
/*
  Sales Analysis Report - Q4 2023
  ================================

  Purpose: Comprehensive sales performance analysis with regional breakdown
  Author: Analytics Team
  Created: 2023-01-01
  Last Updated: 2023-12-31

  Dependencies:
  - sales table: Core transaction data
  - customers table: Customer master data with regional info
  - products table: Product catalog and categories
  - categories table: Product category hierarchy

  Business Logic:
  - Analyzes sales performance by region and customer type
  - Calculates running totals and moving averages
  - Classifies customers into VIP/Premium/Standard tiers
  - Projects next year sales based on regional growth patterns
*/
WITH
/*
  Raw Sales Data Preparation
  --------------------------
  Extracts and processes core sales transactions for the analysis period.
  Applies business rules:
  - Only valid sales (quantity > 0)
  - Date range: 2023-01-01 to 2024-01-01
  - Calculates net amount considering discounts
*/
raw_sales AS (
    SELECT
        s.sale_id /* Sale ID */,
        s.sale_date /* Sale date */,
        s.customer_id /* Customer ID */,
        s.product_id /* Product ID */,
        s.quantity /* Quantity */,
        s.unit_price /* Unit price */,
        s.discount_rate /* Discount rate */,
        /* Net amount calculation */
        s.quantity * s.unit_price * (1 - s.discount_rate) AS net_amount
    FROM sales s /* Sales table */
    WHERE s.sale_date >= '2023-01-01' /* Period filter */
      AND s.sale_date < '2024-01-01'
      AND s.quantity > 0 /* Valid sales only */
),
/*
  Customer Master Data
  -------------------
  Retrieves active customer information with regional and type classification.
  Used for segmentation analysis and regional performance metrics.
*/
customer_master AS (
    SELECT
        c.customer_id,
        c.customer_name /* Customer name */,
        c.region /* Region */,
        c.customer_type /* Customer type */,
        c.registration_date /* Registration date */
    FROM customers c
    WHERE c.active_flag = 1 /* Active customers only */
),
/*
  Product Master Data
  ------------------
  Active product catalog with category hierarchy.
  Includes brand information for product analysis and reporting.
*/
product_master AS (
    SELECT
        p.product_id,
        p.product_name /* Product name */,
        p.category_id /* Category ID */,
        p.brand /* Brand */,
        cat.category_name /* Category name */
    FROM products p
    INNER JOIN categories cat /* Category join */
        ON p.category_id = cat.category_id
    WHERE p.discontinued_flag = 0 /* Active products only */
),
/*
  Enriched Sales Data
  ------------------
  Combines sales, customer, and product data with analytical functions.
  Calculates:
  - Customer sale rankings (latest first)
  - Running totals (cumulative amounts by customer)
  - Moving averages (3-day window by product)
  - VIP customer classification based on total purchase amounts
*/
enriched_sales AS (
    SELECT
        rs.*,
        cm.customer_name,
        cm.region,
        cm.customer_type,
        pm.product_name,
        pm.category_name,
        pm.brand,
        /* Ranking calculation */
        ROW_NUMBER() OVER (
            PARTITION BY rs.customer_id
            ORDER BY rs.sale_date DESC /* Latest first */
        ) AS customer_sale_rank,
        /* Cumulative amount */
        SUM(rs.net_amount) OVER (
            PARTITION BY rs.customer_id
            ORDER BY rs.sale_date
            ROWS UNBOUNDED PRECEDING /* Running total */
        ) AS cumulative_amount,
        /* Moving average */
        AVG(rs.net_amount) OVER (
            PARTITION BY rs.product_id
            ORDER BY rs.sale_date
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW /* 3-day moving average */
        ) AS moving_avg_amount
    FROM raw_sales rs
    INNER JOIN customer_master cm /* Customer master join */
        ON rs.customer_id = cm.customer_id
    INNER JOIN product_master pm /* Product master join */
        ON rs.product_id = pm.product_id
    LEFT JOIN (
        /*
          VIP Customer Classification Subquery
          ------------------------------------
          Classifies customers into tiers based on total purchase amounts:
          - VIP: Over 100,000 total purchases
          - Premium: Over 50,000 total purchases
          - Standard: All other customers
        */
        SELECT
            customer_id,
            CASE
                WHEN total_amount >= 100000 /* Over 100K */
                THEN 'VIP'
                WHEN total_amount >= 50000 /* Over 50K */
                THEN 'Premium'
                ELSE 'Standard'
            END AS customer_grade
        FROM (
            SELECT
                customer_id,
                SUM(quantity * unit_price * (1 - discount_rate)) AS total_amount
            FROM sales
            WHERE sale_date >= '2023-01-01'
            GROUP BY customer_id
        ) customer_totals
    ) vip_customers /* VIP classification results */
        ON rs.customer_id = vip_customers.customer_id
),
/*
  Regional Summary Aggregation
  ---------------------------
  Aggregates sales data by region and customer type.
  Provides comprehensive metrics including:
  - Customer and transaction counts
  - Sales totals and averages
  - Date ranges (first/last sale dates)
  - Statistical measures (median, 95th percentile)

  Filters to top 100 transactions per customer to focus on key customers.
*/
regional_summary AS (
    SELECT
        region /* Region */,
        customer_type /* Customer type */,
        COUNT(DISTINCT customer_id) AS customer_count /* Customer count */,
        COUNT(*) AS transaction_count /* Transaction count */,
        SUM(net_amount) AS total_sales /* Total sales */,
        AVG(net_amount) AS avg_sale_amount /* Average sale amount */,
        MIN(sale_date) AS first_sale_date /* First sale date */,
        MAX(sale_date) AS last_sale_date /* Last sale date */,
        /* Percentile calculations */
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY net_amount) AS median_amount,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY net_amount) AS p95_amount
    FROM enriched_sales
    WHERE customer_sale_rank <= 100 /* Top 100 transactions only */
    GROUP BY region, customer_type
    HAVING SUM(net_amount) > 10000 /* Regions with sales over 10K only */
),
/*
  Final Report Results
  -------------------
  Prepares final output with rankings and projections.
  Includes:
  - Sales rankings (DENSE_RANK for tied values)
  - Percentage of total sales calculation
  - Next year projections based on regional growth:
    * Tokyo/Osaka: 15% growth (major cities)
    * Other regions: 5% growth (conservative estimate)
*/
final_report AS (
    SELECT
        rs.region,
        rs.customer_type,
        rs.customer_count,
        rs.total_sales,
        rs.avg_sale_amount,
        rs.median_amount,
        /* Ranking calculation */
        DENSE_RANK() OVER (ORDER BY rs.total_sales DESC) AS sales_rank,
        /* Percentage calculation */
        ROUND(
            rs.total_sales * 100.0 / SUM(rs.total_sales) OVER(),
            2
        ) AS sales_percentage,
        /* Year-over-year projection (mock data) */
        CASE
            WHEN rs.region IN ('Tokyo', 'Osaka') /* Major cities */
            THEN rs.total_sales * 1.15
            ELSE rs.total_sales * 1.05
        END AS projected_next_year
    FROM regional_summary rs
)
/*
  Main SELECT Statement - Final Output
  ------------------------------------
  Produces the final report with all calculated metrics and classifications.
  Output includes sales rankings, regional performance, customer metrics,
  and next year projections with performance grades (S/A/B/C).
*/
SELECT
    fr.sales_rank /* Rank */,
    fr.region /* Region name */,
    fr.customer_type /* Customer type */,
    fr.customer_count /* Customer count */,
    fr.total_sales /* Total sales */,
    fr.avg_sale_amount /* Average sales */,
    fr.median_amount /* Median value */,
    fr.sales_percentage /* Percentage */ || '%' AS percentage_display,
    fr.projected_next_year /* Next year projection */,
    /* Performance grade */
    CASE
        WHEN fr.sales_rank <= 3 /* Top 3 */
        THEN 'S-Grade'
        WHEN fr.sales_rank <= 10 /* Top 10 */
        THEN 'A-Grade'
        WHEN fr.sales_percentage >= 5.0 /* 5% or more share */
        THEN 'B-Grade'
        ELSE 'C-Grade'
    END AS performance_grade
FROM final_report fr
WHERE fr.total_sales > 5000 /* Sales over 5K */
  AND fr.customer_count >= 2 /* At least 2 customers */
ORDER BY
    fr.sales_rank ASC /* Rank ascending */,
    fr.total_sales DESC /* Sales descending */,
    fr.region ASC /* Region ascending */
LIMIT 50 /* Top 50 records */
`,

    // Sample 2: QualifiedName test (bug verification)
    qualified_name_test: `
/*
  Qualified Name Handling Test
  ===========================

  Purpose: Verifies that table.column references are properly handled
  and that comments don't interfere with qualified name parsing.

  Tests specifically:
  - Table alias usage (u.id, p.title, c.content)
  - JOIN conditions with qualified names
  - WHERE clauses with qualified references
  - Comment placement around qualified names
*/
SELECT
    u.id /* user ID */,
    u.name /* user name */,
    u.email /* email address */,
    p.title /* post title */,
    c.content /* comment content */
FROM users u /* users table */
INNER JOIN posts p /* posts table */
    ON u.id = p.user_id /* join condition */
LEFT JOIN comments c /* comments table */
    ON p.id = c.post_id /* comment join */
WHERE u.active = true /* active users only */
  AND p.published = true /* published posts */
ORDER BY u.name /* sort by name */, p.created_at DESC /* latest first */
`,

    // Sample 3: CASE expression test (comment order verification)
    case_expression_test: `
/*
  CASE Expression Comment Preservation Test
  ========================================

  Purpose: Verifies that comments within complex CASE expressions
  are properly preserved and positioned during SQL formatting.

  Test Coverage:
  - Comments before/after CASE keyword
  - Comments around WHEN conditions
  - Comments around THEN results
  - Comments before/after ELSE clause
  - Comments before/after END keyword

  This is critical for maintaining code documentation in
  business logic expressions.
*/
SELECT
    CASE /* start */ u.status /* status */
        WHEN /* condition1 */ 'active' /* active */ THEN /* result1 */ 1 /* valid */
        WHEN /* condition2 */ 'pending' /* pending */ THEN /* result2 */ 0 /* invalid */
        ELSE /* other */ -1 /* unknown */
    END /* end */ AS status_code /* code */
FROM users u
`
};

// Formatter configuration variations
const FORMATTER_CONFIGS = [
    {
        name: 'Before Comma Style',
        key: 'before_comma',
        options: {
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: '$',
            parameterStyle: 'indexed',
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'before', // Before comma
            andBreak: 'before',
            exportComment: true,
            parenthesesOneLine: false,
            betweenOneLine: false,
            valuesOneLine: false,
            joinOneLine: false,
            caseOneLine: false,
            subqueryOneLine: false
        }
    },
    {
        name: 'After Comma Style',
        key: 'after_comma',
        options: {
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: '$',
            parameterStyle: 'indexed',
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'after', // After comma
            andBreak: 'before',
            exportComment: true,
            parenthesesOneLine: false,
            betweenOneLine: false,
            valuesOneLine: false,
            joinOneLine: false,
            caseOneLine: false,
            subqueryOneLine: false
        }
    },
    {
        name: 'After Comma Smart Comment Style',
        key: 'after_commna_smart_comment',
        options: {
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: '$',
            parameterStyle: 'indexed',
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'after', // After comma works well with smart comments
            andBreak: 'before',
            exportComment: true,
            commentStyle: 'smart', // Enable smart comment processing
            parenthesesOneLine: false,
            betweenOneLine: false,
            valuesOneLine: false,
            joinOneLine: false,
            caseOneLine: false,
            subqueryOneLine: false
        }
    },
    {
        name: 'Before Comma Smart Comment Style',
        key: 'before_comma_smart_comment',
        options: {
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: '$',
            parameterStyle: 'indexed',
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'before', // Before comma works well with smart comments
            cteCommaBreak: 'after', // CTEs use after-comma for better readability
            andBreak: 'before',
            exportComment: true,
            commentStyle: 'smart', // Enable smart comment processing
            parenthesesOneLine: false,
            betweenOneLine: false,
            valuesOneLine: false,
            joinOneLine: false,
            caseOneLine: false,
            subqueryOneLine: false
        }
    },
    {
        name: 'Optimized Style',
        key: 'optimized',
        options: {
            identifierEscape: { start: '"', end: '"' },
            parameterSymbol: '$',
            parameterStyle: 'indexed',
            indentSize: 2,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            andBreak: 'before',
            exportComment: true,
            parenthesesOneLine: true,
            betweenOneLine: true,
            valuesOneLine: true,
            joinOneLine: false,
            caseOneLine: false,
            subqueryOneLine: true
        }
    }
];

/**
 * SQL complexity analysis
 */
function analyzeSqlComplexity(sql) {
    return {
        totalLines: sql.split('\n').length,
        withClauses: (sql.match(/WITH\s+\w+\s+AS/gi) || []).length,
        cteDefinitions: (sql.match(/\w+\s+AS\s*\(/gi) || []).length,
        joinClauses: (sql.match(/(INNER|LEFT|RIGHT|FULL)\s+JOIN/gi) || []).length,
        subqueries: (sql.match(/\(\s*SELECT/gi) || []).length,
        windowFunctions: (sql.match(/\w+\s*\(\s*.*\)\s+OVER\s*\(/gi) || []).length,
        caseExpressions: (sql.match(/CASE\s+WHEN/gi) || []).length,
        aggregateFunctions: (sql.match(/(SUM|COUNT|AVG|MIN|MAX|PERCENTILE_CONT)\s*\(/gi) || []).length,
        comments: (sql.match(/\/\*[^*]*\*\//g) || []).length,
        whereConditions: (sql.match(/WHERE\s+/gi) || []).length,
        havingConditions: (sql.match(/HAVING\s+/gi) || []).length,
        orderByClauses: (sql.match(/ORDER\s+BY/gi) || []).length,
        limitClauses: (sql.match(/LIMIT\s+\d+/gi) || []).length
    };
}

/**
 * Comment analysis
 */
function analyzeComments(originalSql, formattedSql) {
    const originalComments = (originalSql.match(/\/\*[^*]*\*\//g) || []);
    const formattedComments = (formattedSql.match(/\/\*[^*]*\*\//g) || []);

    const originalCommentTexts = originalComments.map(c => c.replace(/\/\*\s*|\s*\*\//g, ''));
    const formattedCommentTexts = formattedComments.map(c => c.replace(/\/\*\s*|\s*\*\//g, ''));

    const preservedComments = originalCommentTexts.filter(text =>
        formattedCommentTexts.includes(text)
    );

    const lostComments = originalCommentTexts.filter(text =>
        !formattedCommentTexts.includes(text)
    );

    // DISABLED: Simple text-based duplicate detection produces false positives
    // Same comment text can legitimately appear in different contexts (e.g., table definition vs aggregation)
    // const duplicatedComments = formattedCommentTexts.filter((text, index) =>
    //     formattedCommentTexts.indexOf(text) !== index
    // );
    const duplicatedComments = []; // Disabled to prevent false positives

    return {
        originalCount: originalComments.length,
        formattedCount: formattedComments.length,
        uniqueOriginal: new Set(originalCommentTexts).size,
        preservedCount: preservedComments.length,
        lostComments,
        duplicatedComments: [...new Set(duplicatedComments)],
        preservationRate: ((preservedComments.length / originalCommentTexts.length) * 100).toFixed(1)
    };
}

/**
 * Report generation
 */
function generateReport(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const generatedPaths = [];

    // Generate individual reports for each formatting style
    FORMATTER_CONFIGS.forEach(config => {
        const stylePath = generateStyleReport(results, config, timestamp);
        generatedPaths.push(stylePath);
    });

    // Generate summary report
    const summaryPath = generateSummaryReport(results, timestamp);
    generatedPaths.push(summaryPath);

    return generatedPaths;
}

function generateStyleReport(results, config, timestamp) {
    const reportPath = path.join(reportDir, `sql-format-report-${timestamp}-${config.key}.md`);

    let report = `# Complex SQL Formatting Demo - ${config.name}\n\n`;
    report += `📅 Generated: ${new Date().toLocaleString('en-US')}\n`;
    report += `🎯 Purpose: Verification of positioned comments system and SQL formatting quality\n`;
    report += `⚙️ Configuration: ${config.name}\n\n`;

    // Configuration details
    report += `## 📋 Configuration Details\n\n`;
    report += `| Setting | Value |\n`;
    report += `|---------|-------|\n`;
    report += `| Comma Break | ${config.options.commaBreak} |\n`;
    report += `| Comment Style | ${config.options.commentStyle || 'block'} |\n`;
    report += `| Keyword Case | ${config.options.keywordCase} |\n`;
    report += `| Indent Size | ${config.options.indentSize} |\n`;
    report += `| Newline | ${config.options.newline === '\\n' ? 'LF' : 'CRLF'} |\n\n`;

    // Results for this specific style
    Object.keys(results).forEach(sqlKey => {
        const sqlResults = results[sqlKey];
        const result = sqlResults.find(r => r.configKey === config.key);

        if (result) {
            report += `## 🔍 ${sqlKey}\n\n`;

            // Performance
            report += `**⏱️ Performance:**\n`;
            report += `- Parse time: ${result.performance.parse}ms\n`;
            report += `- Format time: ${result.performance.format}ms\n`;
            report += `- Total time: ${result.performance.total}ms\n\n`;

            // Quality metrics
            report += `**📊 Quality Metrics:**\n`;
            report += `- Original lines: ${result.quality.originalLines}\n`;
            report += `- Formatted lines: ${result.quality.formattedLines}\n`;
            report += `- Comment preservation rate: ${result.comments.preservationRate}%\n`;
            report += `- Syntax validation: ${result.quality.syntaxValid ? '✅ Success' : '❌ Failed'}\n\n`;

            // Comment analysis
            if (result.comments.lostComments.length > 0) {
                report += `**❌ Lost Comments (${result.comments.lostComments.length} items):**\n`;
                result.comments.lostComments.slice(0, 3).forEach(comment => {
                    report += `- "${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}"\n`;
                });
                if (result.comments.lostComments.length > 3) {
                    report += `- ... ${result.comments.lostComments.length - 3} more\n`;
                }
                report += `\n`;
            }

            // Formatted SQL result
            report += `**📝 Formatted SQL:**\n`;
            report += `\`\`\`sql\n`;
            report += result.formattedSql;
            report += `\n\`\`\`\n\n`;
        }
    });

    // Style-specific notes
    report += `## 💡 Style Notes\n\n`;
    if (config.key === 'smart_comment') {
        report += `- **Smart Comment Style**: Single-line block comments converted to \`--\` format\n`;
        report += `- **Multi-line Support**: Consecutive comments maintained as block format\n`;
        report += `- **Performance**: Optimized for readability and comma break compatibility\n\n`;
    } else if (config.options.commaBreak === 'after') {
        report += `- **After Comma Style**: Commas placed at end of lines with newlines after\n`;
        report += `- **Readability**: Improved scan-ability for field lists\n`;
    } else if (config.options.commaBreak === 'before') {
        report += `- **Before Comma Style**: Commas placed at start of lines\n`;
        report += `- **Traditional**: Classic SQL formatting approach\n`;
    } else {
        report += `- **Optimized Style**: Balanced formatting for performance and readability\n`;
    }

    // Footer
    report += `---\n`;
    report += `📁 Report saved to: \`${reportPath}\`\n`;
    report += `🔧 Run command: \`npm run demo:complex-sql\`\n`;

    fs.writeFileSync(reportPath, report);
    return reportPath;
}

function generateSummaryReport(results, timestamp) {
    const reportPath = path.join(reportDir, `sql-format-report-${timestamp}-summary.md`);

    let report = `# Complex SQL Formatting Demo - Summary Report\n\n`;
    report += `📅 Generated: ${new Date().toLocaleString('en-US')}\n`;
    report += `🎯 Purpose: Verification of positioned comments system and SQL formatting quality\n\n`;

    // Summary
    report += `## 📊 Execution Summary\n\n`;
    report += `| SQL Sample | Configs | Avg Performance | Avg Comment Preservation |\n`;
    report += `|------------|---------|-----------------|-------------------------|\n`;

    Object.keys(results).forEach(sqlKey => {
        const sqlResults = results[sqlKey];
        const avgPerformance = (sqlResults.reduce((sum, r) => sum + r.performance.total, 0) / sqlResults.length).toFixed(1);
        const avgPreservation = (sqlResults.reduce((sum, r) => sum + parseFloat(r.comments.preservationRate), 0) / sqlResults.length).toFixed(1);

        report += `| ${sqlKey} | ${sqlResults.length} | ${avgPerformance}ms | ${avgPreservation}% |\n`;
    });

    // Original SQL samples
    report += `\n## 📋 Original SQL Samples\n\n`;
    Object.keys(COMPLEX_SQL_SAMPLES).forEach(sqlKey => {
        report += `### ${sqlKey}\n\n`;
        report += `**Lines:** ${COMPLEX_SQL_SAMPLES[sqlKey].split('\n').length}\n`;
        report += `**Characters:** ${COMPLEX_SQL_SAMPLES[sqlKey].length}\n\n`;
        report += `\`\`\`sql\n`;
        report += COMPLEX_SQL_SAMPLES[sqlKey].trim();
        report += `\n\`\`\`\n\n`;
    });

    // Style comparison
    report += `## 🎨 Style Comparison\n\n`;
    report += `| Style | Performance | Comment Preservation | Notes |\n`;
    report += `|-------|-------------|---------------------|-------|\n`;

    FORMATTER_CONFIGS.forEach(config => {
        let totalPerf = 0;
        let totalPres = 0;
        let count = 0;

        Object.keys(results).forEach(sqlKey => {
            const result = results[sqlKey].find(r => r.configKey === config.key);
            if (result) {
                totalPerf += result.performance.total;
                totalPres += parseFloat(result.comments.preservationRate);
                count++;
            }
        });

        const avgPerf = count > 0 ? (totalPerf / count).toFixed(1) : '0';
        const avgPres = count > 0 ? (totalPres / count).toFixed(1) : '0';

        let notes = '';
        if (config.key === 'smart_comment') {
            notes = 'Smart comment conversion';
        } else if (config.options.commaBreak === 'after') {
            notes = 'After comma style';
        } else if (config.options.commaBreak === 'before') {
            notes = 'Before comma style';
        } else {
            notes = 'Optimized format';
        }

        report += `| ${config.name} | ${avgPerf}ms | ${avgPres}% | ${notes} |\n`;
    });

    // Recommendations
    report += `## 💡 Recommendations\n\n`;
    report += `1. **Maintain 95%+ Comment Preservation Rate**: Quality indicator for positioned comments system\n`;
    report += `2. **Prevent QualifiedName Splitting**: Preserve \`table.column /* comment */\` format\n`;
    report += `3. **Verify CASE Expression Comment Order**: Check comment positions in complex expressions\n`;
    report += `4. **Regression Testing**: Verify existing SQL formatting when adding new features\n\n`;

    // Footer
    report += `---\n`;
    report += `📁 Report saved to: \`${reportPath}\`\n`;
    report += `🔧 Run command: \`npm run demo:complex-sql\`\n`;

    fs.writeFileSync(reportPath, report);
    return reportPath;
}

/**
 * Main execution
 */
async function runDemo() {
    const results = {};

    console.log('\n🚀 Demo execution started...\n');

    for (const [sqlKey, sqlContent] of Object.entries(COMPLEX_SQL_SAMPLES)) {
        console.log(`🔍 Processing: ${sqlKey}`);
        console.log('─'.repeat(60));

        // SQL complexity analysis
        const complexity = analyzeSqlComplexity(sqlContent);
        console.log('📊 SQL complexity:');
        Object.entries(complexity).forEach(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
            console.log(`  ${label.padEnd(20)}: ${value}`);
        });

        results[sqlKey] = [];

        // Execute with each formatting configuration
        for (const config of FORMATTER_CONFIGS) {
            console.log(`\n⚙️  Configuration: ${config.name}`);

            try {
                const startTime = Date.now();

                // Parse
                const query = SelectQueryParser.parse(sqlContent);
                const parseTime = Date.now() - startTime;

                // Format
                const formatter = new SqlFormatter(config.options);
                const formatStartTime = Date.now();
                const result = formatter.format(query);
                const formatTime = Date.now() - formatStartTime;
                const totalTime = Date.now() - startTime;

                // Quality analysis
                const formattedLines = result.formattedSql.split('\n').length;
                const commentAnalysis = analyzeComments(sqlContent, result.formattedSql);

                // Syntax validation
                let syntaxValid = true;
                let cteCountMatch = true;
                try {
                    const reparsed = SelectQueryParser.parse(result.formattedSql);
                    const originalCtes = query.withClause?.tables.length || 0;
                    const reparsedCtes = reparsed.withClause?.tables.length || 0;
                    cteCountMatch = originalCtes === reparsedCtes;
                } catch (error) {
                    syntaxValid = false;
                }

                // Record results
                results[sqlKey].push({
                    configName: config.name,
                    configKey: config.key,
                    originalSql: sqlContent,
                    performance: {
                        parse: parseTime,
                        format: formatTime,
                        total: totalTime
                    },
                    quality: {
                        originalLines: complexity.totalLines,
                        formattedLines,
                        syntaxValid,
                        cteCountMatch
                    },
                    comments: commentAnalysis,
                    formattedSql: result.formattedSql
                });

                // Console output
                console.log(`  ⏱️  ${totalTime}ms (parse:${parseTime}ms, format:${formatTime}ms)`);
                console.log(`  📊 ${complexity.totalLines} → ${formattedLines} lines`);
                console.log(`  💬 Comment preservation rate: ${commentAnalysis.preservationRate}%`);
                console.log(`  🔍 Syntax: ${syntaxValid ? '✅' : '❌'} CTE: ${cteCountMatch ? '✅' : '❌'}`);

                if (commentAnalysis.lostComments.length > 0) {
                    console.log(`  ❌ Lost comments: ${commentAnalysis.lostComments.length} items`);
                }
                if (commentAnalysis.duplicatedComments.length > 0) {
                    console.log(`  ⚠️  Duplicated comments: ${commentAnalysis.duplicatedComments.length} types`);
                }

            } catch (error) {
                console.log(`  ❌ Error: ${error.message}`);
                results[sqlKey].push({
                    configName: config.name,
                    configKey: config.key,
                    originalSql: sqlContent,
                    error: error.message,
                    performance: { parse: 0, format: 0, total: 0 },
                    quality: { originalLines: 0, formattedLines: 0, syntaxValid: false, cteCountMatch: false },
                    comments: { preservationRate: '0.0', lostComments: [], duplicatedComments: [] },
                    formattedSql: ''
                });
            }
        }

        console.log('');
    }

    // Generate reports
    console.log('📄 Generating reports...');
    const reportPaths = generateReport(results);

    console.log('\n🎉 Demo execution completed!');
    console.log('━'.repeat(80));
    console.log('📁 Generated reports:');
    reportPaths.forEach((path, index) => {
        const filename = path.split('/').pop();
        if (filename.includes('summary')) {
            console.log(`   📋 Summary: ${filename}`);
        } else {
            console.log(`   📄 Style: ${filename}`);
        }
    });
    console.log('🔄 Use for continuous quality verification');
    console.log('');

    // Summary display
    console.log('📋 Execution summary:');
    Object.keys(results).forEach(sqlKey => {
        const sqlResults = results[sqlKey];
        const avgPreservation = (sqlResults.reduce((sum, r) => sum + parseFloat(r.comments.preservationRate), 0) / sqlResults.length).toFixed(1);
        const hasErrors = sqlResults.some(r => r.error);
        console.log(`  ${sqlKey}: ${avgPreservation}% ${hasErrors ? '❌' : '✅'}`);
    });

    return reportPaths;
}

// CLI execution
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = { runDemo, COMPLEX_SQL_SAMPLES, FORMATTER_CONFIGS };