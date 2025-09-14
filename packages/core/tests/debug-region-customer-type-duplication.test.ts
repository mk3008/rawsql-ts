import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug Region and Customer Type Duplication', () => {
    it('should investigate specific Region/Customer type duplicates from demo', () => {
        // Simplified version of the demo SQL focused on the duplicated comments
        const testSQL = `
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
final_report AS (
    SELECT
        cm.region,
        cm.customer_type,
        COUNT(*) as customer_count
    FROM customer_master cm
    GROUP BY cm.region, cm.customer_type
)
SELECT
    fr.region /* Region */,
    fr.customer_type /* Customer type */,
    fr.customer_count
FROM final_report fr
ORDER BY
    fr.region ASC /* Region */,
    fr.customer_type ASC /* Customer type */`;

        console.log('🔍 Testing Region/Customer type comment duplication...');
        console.log('\n📄 Test SQL:');
        console.log(testSQL);

        try {
            const query = SelectQueryParser.parse(`WITH ${testSQL}`);
            const formatter = new SqlFormatter({ exportComment: true, keywordCase: 'lower', commaBreak: 'before' });
            const result = formatter.format(query);

            console.log('\n📝 Formatted SQL:');
            console.log(result.formattedSql);

            // Extract comments
            const commentMatches = result.formattedSql.match(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g) || [];
            const commentTexts = commentMatches.map(match =>
                match.replace(/^\/\*\s*|\s*\*\/$/g, '').trim()
            );

            console.log('\n📝 All comments:');
            commentTexts.forEach((comment, index) => {
                console.log(`[${index}] "${comment}"`);
            });

            // Find specific duplicates
            const regionDuplicates = commentTexts.filter(text => text === 'Region');
            const customerTypeDuplicates = commentTexts.filter(text => text === 'Customer type');

            console.log('\n⚠️ Duplicate Analysis:');
            console.log(`- "Region" appears ${regionDuplicates.length} times`);
            console.log(`- "Customer type" appears ${customerTypeDuplicates.length} times`);

            if (regionDuplicates.length > 1) {
                const positions = commentTexts
                    .map((text, index) => text === 'Region' ? index : -1)
                    .filter(index => index !== -1);
                console.log(`  Region positions: ${positions.join(', ')}`);
            }

            if (customerTypeDuplicates.length > 1) {
                const positions = commentTexts
                    .map((text, index) => text === 'Customer type' ? index : -1)
                    .filter(index => index !== -1);
                console.log(`  Customer type positions: ${positions.join(', ')}`);
            }

        } catch (error) {
            console.error('Parse error:', error.message);
        }

        expect(true).toBe(true);
    });

    it('should test minimal case for QualifiedName comment propagation', () => {
        // Even simpler test to isolate the issue
        const minimalSQL = `
SELECT
    t.region /* Region */,
    count(*) as cnt
FROM table1 t
GROUP BY t.region
ORDER BY t.region /* Region */`;

        console.log('\n🔍 Testing minimal QualifiedName duplication...');
        console.log('\n📄 Minimal SQL:');
        console.log(minimalSQL);

        const query = SelectQueryParser.parse(minimalSQL);
        const formatter = new SqlFormatter({ exportComment: true });
        const result = formatter.format(query);

        console.log('\n📝 Formatted SQL:');
        console.log(result.formattedSql);

        // Count "Region" occurrences
        const regionCount = (result.formattedSql.match(/\/\*\s*Region\s*\*\//g) || []).length;
        console.log(`\n📊 "Region" comment appears ${regionCount} times`);

        if (regionCount > 1) {
            console.log('⚠️ DUPLICATION DETECTED in minimal case');
        } else {
            console.log('✅ No duplication in minimal case');
        }

        expect(true).toBe(true);
    });
});