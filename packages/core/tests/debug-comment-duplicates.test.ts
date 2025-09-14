import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug Comment Duplicates', () => {
    const salesAnalysisSQL = `-- Main query: Sales analysis report
WITH /* Raw data preparation */ raw_sales AS (
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
/* Customer master data */
customer_master AS (
    SELECT
        c.customer_id,
        c.customer_name /* Customer name */,
        c.region /* Region */,
        c.customer_type /* Customer type */,
        c.registration_date /* Registration date */
    FROM customers c
    WHERE c.active_flag = 1 /* Active customers only */
)
SELECT
    cm.region /* Region */,
    cm.customer_type /* Customer type */,
    COUNT(*) as count
FROM raw_sales rs
INNER JOIN customer_master cm ON rs.customer_id = cm.customer_id
GROUP BY cm.region, cm.customer_type
ORDER BY cm.region /* Region */, cm.customer_type /* Customer type */`;

    it('should identify specific comment duplicates', () => {
        console.log('🔍 Finding comment duplicates...');

        const query = SelectQueryParser.parse(salesAnalysisSQL);
        const formatter = new SqlFormatter({ exportComment: true, keywordCase: 'upper', commaBreak: 'before' });
        const result = formatter.format(query);

        console.log('\n📄 Formatted SQL:');
        console.log(result.formattedSql);

        // Extract comments from formatted SQL
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g) || [];
        const commentTexts = commentMatches.map(match =>
            match.replace(/^\/\*\s*|\s*\*\/$/g, '').trim()
        );

        console.log('\n📝 All comments found:');
        commentTexts.forEach((comment, index) => {
            console.log(`[${index}] "${comment}"`);
        });

        // Find duplicates
        const duplicates = commentTexts.filter((text, index) =>
            commentTexts.indexOf(text) !== index
        );

        console.log('\n⚠️ Duplicated comments:');
        [...new Set(duplicates)].forEach(duplicate => {
            const positions = commentTexts
                .map((text, index) => text === duplicate ? index : -1)
                .filter(index => index !== -1);
            console.log(`- "${duplicate}" appears at positions: ${positions.join(', ')}`);
        });

        console.log(`\n📊 Summary: ${duplicates.length} duplicates, ${new Set(duplicates).size} unique`);

        // The test always passes, we just want to see the output
        expect(true).toBe(true);
    });
});