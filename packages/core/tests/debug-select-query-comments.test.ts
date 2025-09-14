import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug SelectQuery Comment Types', () => {
    it('should show how header comments vs SELECT comments are handled', () => {
        // Test case with both header comment and SELECT comment
        const sql = `-- Main query: Sales analysis report
WITH /* Raw data preparation */ raw_sales AS (
    SELECT sale_id, quantity FROM sales
)
/* Main SELECT statement */
SELECT * FROM raw_sales`;

        console.log('\n=== Original SQL ===');
        console.log(sql);

        // Parse
        const query = SelectQueryParser.parse(sql);
        const simpleQuery = query.toSimpleQuery();

        console.log('\n=== SelectQuery Analysis ===');
        console.log('query.comments:', query.comments);
        console.log('query.headerComments:', query.headerComments);
        console.log('query.positionedComments:', query.positionedComments);

        console.log('\n=== SimpleQuery Analysis ===');
        console.log('simpleQuery.comments:', simpleQuery.comments);
        console.log('simpleQuery.headerComments:', simpleQuery.headerComments);
        console.log('simpleQuery.positionedComments:', simpleQuery.positionedComments);

        if (simpleQuery.withClause) {
            console.log('\n=== WithClause Analysis ===');
            console.log('withClause.comments:', simpleQuery.withClause.comments);
            console.log('withClause.headerComments:', simpleQuery.withClause.headerComments);
        }

        // Format and check result
        const formatter = new SqlFormatter({
            identifierEscape: { start: '"', end: '"' },
            exportComment: true,
            keywordCase: 'upper'
        });
        const result = formatter.format(query);

        console.log('\n=== Formatted SQL ===');
        console.log(result.formattedSql);

        // Check for missing comments
        const hasHeaderComment = result.formattedSql.includes('Main query: Sales analysis report');
        const hasSelectComment = result.formattedSql.includes('Main SELECT statement');
        const hasRawDataComment = result.formattedSql.includes('Raw data preparation');

        console.log('\n=== Comment Preservation Check ===');
        console.log('Header comment preserved:', hasHeaderComment);
        console.log('SELECT comment preserved:', hasSelectComment);
        console.log('CTE comment preserved:', hasRawDataComment);

        expect(simpleQuery).toBeDefined();
    });

    it('should test headerComments vs comments distinction', () => {
        // Simpler test case
        const sql = `-- Header comment
SELECT /* SELECT comment */ * FROM users`;

        console.log('\n=== Simple Test SQL ===');
        console.log(sql);

        const query = SelectQueryParser.parse(sql);
        const simpleQuery = query.toSimpleQuery();

        console.log('\n=== Simple Analysis ===');
        console.log('query.headerComments:', query.headerComments);
        console.log('simpleQuery.headerComments:', simpleQuery.headerComments);
        console.log('simpleQuery.comments:', simpleQuery.comments);

        const formatter = new SqlFormatter({
            identifierEscape: { start: '"', end: '"' },
            exportComment: true
        });
        const result = formatter.format(query);

        console.log('\n=== Simple Formatted SQL ===');
        console.log(result.formattedSql);

        expect(result.formattedSql).toContain('Header comment');
        expect(result.formattedSql).toContain('SELECT comment');
    });
});