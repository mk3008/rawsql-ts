import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug Positioned Comments for CTE', () => {
    it('should show how positioned comments are handled for CTE names', () => {
        // Test case with comment before CTE name
        const sql = `WITH /* Raw data preparation */ raw_sales AS (SELECT 1) SELECT * FROM raw_sales`;

        console.log('\n=== Original SQL ===');
        console.log(sql);

        // Parse
        const query = SelectQueryParser.parse(sql);
        const simpleQuery = query.toSimpleQuery();

        const firstCte = simpleQuery.withClause?.tables[0];
        if (firstCte) {
            console.log('\n=== CTE Name Debug Info ===');
            console.log('cte.aliasExpression.table.name:', firstCte.aliasExpression.table.name);
            console.log('cte.aliasExpression.table.comments:', firstCte.aliasExpression.table.comments);
            console.log('cte.aliasExpression.table.positionedComments:', firstCte.aliasExpression.table.positionedComments);

            if (firstCte.aliasExpression.table.positionedComments) {
                firstCte.aliasExpression.table.positionedComments.forEach((comment, index) => {
                    console.log(`  positionedComment[${index}]:`, {
                        text: comment.text || comment.content,
                        position: comment.position || comment.placement,
                        comments: comment.comments,
                        fullObject: JSON.stringify(comment, null, 2)
                    });
                });
            }
        }

        // Format and see result
        const formatter = new SqlFormatter({
            identifierEscape: { start: '"', end: '"' },
            exportComment: true,
            keywordCase: 'upper'
        });
        const result = formatter.format(query);

        console.log('\n=== Formatted SQL ===');
        console.log(result.formattedSql);

        expect(simpleQuery.withClause?.tables).toHaveLength(1);
    });

    it('should test positioned comments with explicit before/after structure', () => {
        // Create a more complex case to understand the structure
        const sql = `WITH /* Before */ cte_name /* After */ AS (SELECT 1) SELECT * FROM cte_name`;

        console.log('\n=== Complex Positioned Comments SQL ===');
        console.log(sql);

        const query = SelectQueryParser.parse(sql);
        const simpleQuery = query.toSimpleQuery();

        const firstCte = simpleQuery.withClause?.tables[0];
        if (firstCte) {
            console.log('\n=== Complex CTE Analysis ===');
            console.log('Legacy comments:', firstCte.aliasExpression.table.comments);
            console.log('Positioned comments:', firstCte.aliasExpression.table.positionedComments);
        }

        const formatter = new SqlFormatter({
            identifierEscape: { start: '"', end: '"' },
            exportComment: true,
            keywordCase: 'upper'
        });
        const result = formatter.format(query);

        console.log('\n=== Complex Formatted SQL ===');
        console.log(result.formattedSql);

        expect(result.formattedSql).toContain('/* Before */');
        expect(result.formattedSql).toContain('/* After */');
    });
});