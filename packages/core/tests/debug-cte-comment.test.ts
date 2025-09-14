import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';

describe('Debug CTE Comment Placement', () => {
    it('should show where CTE comments are stored in AST', () => {
        // Simple test case
        const sql = `WITH /* Raw data preparation */ raw_sales AS (SELECT 1) SELECT * FROM raw_sales`;

        console.log('\n=== SQL ===');
        console.log(sql);

        // Parse
        const query = SelectQueryParser.parse(sql);
        const simpleQuery = query.toSimpleQuery();

        console.log('\n=== AST Structure ===');
        console.log('withClause.comments:', simpleQuery.withClause?.comments);
        console.log('withClause.positionedComments:', simpleQuery.withClause?.positionedComments);

        const firstCte = simpleQuery.withClause?.tables[0];
        if (firstCte) {
            console.log('\n=== First CTE Structure ===');
            console.log('commonTable.comments:', firstCte.comments);
            console.log('commonTable.positionedComments:', firstCte.positionedComments);

            console.log('\n=== CTE Name (aliasExpression.table) ===');
            console.log('cte.aliasExpression.table.name:', firstCte.aliasExpression.table.name);
            console.log('cte.aliasExpression.table.comments:', firstCte.aliasExpression.table.comments);
            console.log('cte.aliasExpression.table.positionedComments:', firstCte.aliasExpression.table.positionedComments);
        }

        // Just verify parse worked
        expect(simpleQuery.withClause?.tables).toHaveLength(1);
    });
});