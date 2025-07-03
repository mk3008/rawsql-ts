import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { CTECollector } from '../src/transformers/CTECollector';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Comment Preservation in CTE Parsing', () => {
    const sqlWithComments = `-- This is the main WITH clause comment
WITH 
-- Comment for users CTE
users AS (
  -- Select all active users
  SELECT * FROM users_table
  WHERE active = true  -- Only active users
),
-- Comment for orders CTE
orders AS (
  -- Join orders with users
  SELECT o.*, u.name
  FROM orders_table o
  -- Inner join to get user details
  INNER JOIN users u ON o.user_id = u.id
)
-- Main query comment
SELECT * FROM orders;`;

    test('should preserve comments in AST structure', () => {
        const query = SelectQueryParser.parse(sqlWithComments);
        
        // Check main query comments
        expect(query.comments).toBeDefined();
        expect(query.comments).toContain('This is the main WITH clause comment');
        expect(query.comments).toContain('Comment for users CTE');
        
        // Check WITH clause comments
        expect(query.withClause?.comments).toBeDefined();
        expect(query.withClause?.comments).toContain('This is the main WITH clause comment');
        
        // Check CTE level comments
        const ctes = query.withClause?.tables || [];
        expect(ctes).toHaveLength(2);
        
        // CTE 2 should have its prefix comment
        expect(ctes[1].comments).toBeDefined();
        expect(ctes[1].comments).toContain('Comment for orders CTE');
        
        // Check CTE inner query comments
        expect(ctes[0].query.comments).toBeDefined();
        expect(ctes[0].query.comments).toContain('Select all active users');
        
        expect(ctes[1].query.comments).toBeDefined();
        expect(ctes[1].query.comments).toContain('Join orders with users');
    });

    test('should preserve comments when collecting CTEs', () => {
        const query = SelectQueryParser.parse(sqlWithComments);
        const cteCollector = new CTECollector();
        const ctes = cteCollector.collect(query);
        
        expect(ctes).toHaveLength(2);
        
        // Verify CTE names
        expect(ctes[0].aliasExpression.table.name).toBe('users');
        expect(ctes[1].aliasExpression.table.name).toBe('orders');
        
        // Verify that comments are preserved in collected CTEs
        expect(ctes[0].query.comments).toContain('Select all active users');
        expect(ctes[1].query.comments).toContain('Join orders with users');
        expect(ctes[1].comments).toContain('Comment for orders CTE');
    });

    test('should format queries with comments when exportComment is true', () => {
        const query = SelectQueryParser.parse(sqlWithComments);
        const formatter = new SqlFormatter({ exportComment: true });
        
        const result = formatter.format(query);
        
        // Check that key comments appear in formatted output
        expect(result.formattedSql).toContain('/* This is the main WITH clause comment */');
        expect(result.formattedSql).toContain('/* Select all active users */');
        expect(result.formattedSql).toContain('/* Join orders with users */');
        expect(result.formattedSql).toContain('/* Only active users */');
        expect(result.formattedSql).toContain('/* Comment for orders CTE */');
    });

    test('should format individual CTE queries with their comments', () => {
        const query = SelectQueryParser.parse(sqlWithComments);
        const cteCollector = new CTECollector();
        const ctes = cteCollector.collect(query);
        const formatter = new SqlFormatter({ exportComment: true });
        
        // Format first CTE
        const cte1Result = formatter.format(ctes[0].query);
        expect(cte1Result.formattedSql).toContain('/* Select all active users */');
        expect(cte1Result.formattedSql).toContain('/* Only active users */');
        
        // Format second CTE
        const cte2Result = formatter.format(ctes[1].query);
        expect(cte2Result.formattedSql).toContain('/* Join orders with users */');
    });

    test('should not include comments when exportComment is false', () => {
        const query = SelectQueryParser.parse(sqlWithComments);
        const formatter = new SqlFormatter({ exportComment: false });
        
        const result = formatter.format(query);
        
        // Check that comments are not included in formatted output
        expect(result.formattedSql).not.toContain('/*');
        expect(result.formattedSql).not.toContain('*/');
    });
});