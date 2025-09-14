import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug QualifiedName Comment Duplication', () => {
    it('should investigate QualifiedName comment propagation', () => {
        const testSQL = `
WITH customer_master AS (
    SELECT
        c.customer_id,
        c.region /* Region comment */,
        c.customer_type /* Customer type comment */
    FROM customers c
)
SELECT
    cm.region /* Should this duplicate? */,
    cm.customer_type /* Should this duplicate? */,
    COUNT(*) as count
FROM customer_master cm
GROUP BY cm.region, cm.customer_type
ORDER BY cm.region /* Another duplicate? */, cm.customer_type /* Another duplicate? */`;

        console.log('\n🔍 Testing QualifiedName comment duplication...');
        console.log('\n📄 Original SQL:');
        console.log(testSQL);

        const query = SelectQueryParser.parse(testSQL);
        const formatter = new SqlFormatter({ exportComment: true, keywordCase: 'upper' });
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

        // Check for duplicates
        const duplicates = commentTexts.filter((text, index) =>
            commentTexts.indexOf(text) !== index
        );

        if (duplicates.length > 0) {
            console.log('\n⚠️ Found duplicates:');
            [...new Set(duplicates)].forEach(duplicate => {
                const positions = commentTexts
                    .map((text, index) => text === duplicate ? index : -1)
                    .filter(index => index !== -1);
                console.log(`- "${duplicate}" at positions: ${positions.join(', ')}`);
            });
        } else {
            console.log('\n✅ No duplicates found');
        }

        expect(true).toBe(true);
    });

    it('should debug AST structure for duplicated comments', () => {
        const testSQL = `
SELECT
    cm.region /* Region */,
    COUNT(*) as count
FROM customer_master cm
ORDER BY cm.region /* Region */`;

        const query = SelectQueryParser.parse(testSQL);

        console.log('\n🔍 AST structure analysis...');

        // Check SELECT clause items
        const selectQuery = query.toSimpleQuery();
        console.log('\n📋 SELECT clause items:');
        selectQuery.selectClause.items.forEach((item, index) => {
            console.log(`Item[${index}]:`, {
                type: item.constructor.name,
                comments: (item as any).comments,
                positionedComments: (item as any).positionedComments
            });

            // Check if it's a QualifiedName
            if ((item as any).value && (item as any).value.constructor.name === 'QualifiedName') {
                const qualifiedName = (item as any).value;
                console.log(`  QualifiedName:`, {
                    table: qualifiedName.table?.name || 'undefined',
                    column: qualifiedName.name?.name || 'undefined',
                    tableComments: qualifiedName.table?.comments,
                    columnComments: qualifiedName.name?.comments,
                    columnPositionedComments: qualifiedName.name?.positionedComments
                });
            }
        });

        // Check ORDER BY clause
        if (selectQuery.orderByClause) {
            console.log('\n📋 ORDER BY clause structure:');
            console.log('orderByClause type:', selectQuery.orderByClause.constructor.name);
            console.log('orderByClause properties:', Object.keys(selectQuery.orderByClause));

            if (selectQuery.orderByClause.order) {
                selectQuery.orderByClause.order.forEach((item, index) => {
                console.log(`OrderItem[${index}]:`, {
                    type: item.constructor.name,
                    comments: (item as any).comments,
                    positionedComments: (item as any).positionedComments
                });

                // Check the value property for QualifiedName
                if ((item as any).value && (item as any).value.constructor.name === 'QualifiedName') {
                    const qualifiedName = (item as any).value;
                    console.log(`  QualifiedName:`, {
                        table: qualifiedName.table?.name || 'undefined',
                        column: qualifiedName.name?.name || 'undefined',
                        tableComments: qualifiedName.table?.comments,
                        columnComments: qualifiedName.name?.comments,
                        columnPositionedComments: qualifiedName.name?.positionedComments
                    });
                }
            });
            } else {
                console.log('No order property found in orderByClause');
            }
        }

        expect(true).toBe(true);
    });
});