import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug Actual Demo SQL', () => {
    // Exact SQL from the demo report
    const actualDemoSQL = `-- Main query: Sales analysis report
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
),
regional_summary AS (
    SELECT
        region /* Region */,
        customer_type /* Customer type */,
        COUNT(DISTINCT customer_id) AS customer_count /* Customer count */,
        SUM(net_amount) AS total_sales /* Total sales */
    FROM enriched_sales
    GROUP BY region, customer_type
)
SELECT
    fr.region /* Region */,
    fr.customer_type /* Customer type */,
    fr.total_sales
FROM regional_summary fr
ORDER BY
    fr.region ASC /* Region ascending */,
    fr.customer_type ASC /* Customer type ascending */`;

    it('should identify actual duplications in demo SQL', () => {
        console.log('🔍 Analyzing ACTUAL demo SQL for duplications...');

        const query = SelectQueryParser.parse(actualDemoSQL);
        const formatter = new SqlFormatter({ exportComment: true, commaBreak: 'before' });
        const result = formatter.format(query);

        console.log('\n📝 Formatted SQL:');
        console.log(result.formattedSql);

        // Extract ALL comments
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g) || [];
        const commentTexts = commentMatches.map((match, index) => ({
            index,
            text: match.replace(/^\/\*\s*|\s*\*\/$/g, '').trim(),
            raw: match
        }));

        console.log('\n📝 ALL COMMENTS WITH POSITIONS:');
        commentTexts.forEach(({ index, text, raw }) => {
            console.log(`[${index}] "${text}" (${raw})`);
        });

        // Find exact duplicates
        const textCounts = {};
        commentTexts.forEach(({ text }) => {
            textCounts[text] = (textCounts[text] || 0) + 1;
        });

        const duplicates = Object.entries(textCounts).filter(([text, count]) => count > 1);

        console.log('\n⚠️ ACTUAL DUPLICATIONS:');
        duplicates.forEach(([text, count]) => {
            const positions = commentTexts
                .filter(c => c.text === text)
                .map(c => c.index);
            console.log(`- "${text}" appears ${count} times at positions: ${positions.join(', ')}`);
        });

        if (duplicates.length === 0) {
            console.log('✅ NO DUPLICATIONS FOUND in this simplified version');
        }

        expect(true).toBe(true);
    });

    it('should check if ORDER BY comments are lost', () => {
        console.log('\n🔍 Checking ORDER BY comment preservation...');

        const simpleOrderBySQL = `
SELECT
    id,
    name
FROM users
ORDER BY
    id ASC /* ID ascending */,
    name DESC /* Name descending */`;

        const query = SelectQueryParser.parse(simpleOrderBySQL);
        const formatter = new SqlFormatter({ exportComment: true });
        const result = formatter.format(query);

        console.log('\n📄 Original SQL:');
        console.log(simpleOrderBySQL);

        console.log('\n📝 Formatted SQL:');
        console.log(result.formattedSql);

        const hasIdComment = result.formattedSql.includes('/* ID ascending */');
        const hasNameComment = result.formattedSql.includes('/* Name descending */');

        console.log('\n📊 ORDER BY comment preservation:');
        console.log(`- "ID ascending" preserved: ${hasIdComment ? '✅' : '❌'}`);
        console.log(`- "Name descending" preserved: ${hasNameComment ? '✅' : '❌'}`);

        if (!hasIdComment || !hasNameComment) {
            console.log('⚠️ ORDER BY comments are being LOST!');
        }

        expect(true).toBe(true);
    });
});