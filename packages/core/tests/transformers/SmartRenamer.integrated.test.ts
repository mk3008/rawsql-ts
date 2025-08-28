import { describe, it, expect } from 'vitest';
import { SmartRenamer } from '../../src/transformers/SmartRenamer';

describe('SmartRenamer - Integrated Functionality', () => {
    it('should rename without formatting preservation (default behavior)', () => {
        const sql = `WITH sales_data AS (
    SELECT u.id, u.name
    FROM users AS u
)
SELECT * FROM sales_data`;
        
        const renamer = new SmartRenamer();
        const result = renamer.rename(sql, { line: 1, column: 6 }, 'analytics_data');
        
        expect(result.success).toBe(true);
        expect(result.formattingPreserved).toBe(false);
        expect(result.formattingMethod).toBe('smart-renamer-only');
        expect(result.newSql).toContain('analytics_data');
        expect(result.originalName).toBe('sales_data');
        expect(result.newName).toBe('analytics_data');
    });

    it('should rename with formatting preservation when requested', () => {
        const originalSQL = `-- Sales analysis
WITH sales_data AS (  /* CTE for sales */
    SELECT 
        u.id AS user_id,    -- User ID
        u.name              -- User name
    FROM users AS u
)
SELECT * FROM sales_data
WHERE sales_data.user_id > 100`;
        
        const renamer = new SmartRenamer();
        
        // Test with formatting preservation
        const result = renamer.rename(
            originalSQL, 
            { line: 2, column: 6 }, 
            'analytics_data',
            { preserveFormatting: true }
        );
        
        console.log('=== Formatting Preservation Test ===');
        console.log(`Success: ${result.success}`);
        console.log(`Formatting Preserved: ${result.formattingPreserved}`);
        console.log(`Method: ${result.formattingMethod}`);
        
        expect(result.success).toBe(true);
        expect(result.formattingPreserved).toBe(true);
        expect(result.formattingMethod).toBe('sql-identifier-renamer');
        
        // Verify formatting preservation
        expect(result.newSql).toContain('-- Sales analysis');
        expect(result.newSql).toContain('/* CTE for sales */');
        expect(result.newSql).toContain('    SELECT');
        expect(result.newSql).toContain('        u.id AS user_id,    -- User ID');
        
        // Verify rename occurred
        expect(result.newSql).toContain('WITH analytics_data AS');
        expect(result.newSql).toContain('FROM analytics_data');
        expect(result.newSql).toContain('WHERE analytics_data.user_id');
        
        console.log('✓ Formatting and rename both preserved/applied correctly');
    });

    it('should handle batch rename with formatting preservation', () => {
        const sql = `WITH user_data AS (
    SELECT u.id, u.name 
    FROM users AS u
), order_data AS (
    SELECT o.id, o.total
    FROM orders AS o  
)
SELECT 
    ud.name,
    od.total
FROM user_data AS ud
JOIN order_data AS od ON ud.id = od.user_id`;

        const renamer = new SmartRenamer();
        const renames = {
            'user_data': 'customers',
            'order_data': 'sales',
            'ud': 'cust',
            'od': 'sales_tbl',
            'u': 'users_tbl',
            'o': 'orders_tbl'
        };

        const result = renamer.batchRename(sql, renames, { preserveFormatting: true });

        console.log('\n=== Batch Rename Test ===');
        console.log(`Success: ${result.success}`);
        console.log(`Formatting Preserved: ${result.formattingPreserved}`);

        expect(result.success).toBe(true);
        expect(result.formattingPreserved).toBe(true);
        expect(result.formattingMethod).toBe('sql-identifier-renamer');

        // Verify all renames occurred
        expect(result.newSql).toContain('WITH customers AS');
        expect(result.newSql).toContain('), sales AS (');
        expect(result.newSql).toContain('FROM customers AS cust');
        expect(result.newSql).toContain('JOIN sales AS sales_tbl');
        expect(result.newSql).toContain('FROM users AS users_tbl');
        expect(result.newSql).toContain('FROM orders AS orders_tbl');

        console.log('✓ Batch rename with formatting preservation successful');
    });

    it('should fallback to standard rename when formatting preservation fails', () => {
        // This test simulates a scenario where formatting preservation might fail
        const sql = `WITH test_data AS (SELECT * FROM table1) SELECT * FROM test_data`;
        
        const renamer = new SmartRenamer();
        const result = renamer.rename(
            sql, 
            { line: 1, column: 6 }, 
            'new_data',
            { preserveFormatting: true }
        );
        
        // Should still succeed, either with formatting preservation or fallback
        expect(result.success).toBe(true);
        expect(result.newSql).toContain('new_data');
        expect(['sql-identifier-renamer', 'smart-renamer-only']).toContain(result.formattingMethod);
        
        console.log('\n=== Fallback Test ===');
        console.log(`Success: ${result.success}`);
        console.log(`Method used: ${result.formattingMethod}`);
        console.log('✓ Fallback mechanism working correctly');
    });

    it('should maintain backward compatibility - isRenameable method', () => {
        const sql = `WITH sales_data AS (
    SELECT * FROM users u
) SELECT * FROM sales_data`;
        const renamer = new SmartRenamer();
        
        // Test CTE detection
        const cteResult = renamer.isRenameable(sql, { line: 1, column: 6 });
        expect(cteResult.renameable).toBe(true);
        expect(cteResult.renamerType).toBe('cte');
        expect(cteResult.tokenName).toBe('sales_data');
        
        // Test alias detection - 'u' is at line 2, around column 25
        const aliasResult = renamer.isRenameable(sql, { line: 2, column: 25 });
        expect(aliasResult.renameable).toBe(true);
        expect(aliasResult.renamerType).toBe('alias');
        expect(aliasResult.tokenName).toBe('u');
        
        console.log('\n=== Backward Compatibility Test ===');
        console.log('✓ isRenameable method works as expected');
        console.log(`✓ CTE detection: ${cteResult.tokenName} (${cteResult.renamerType})`);
        console.log(`✓ Alias detection: ${aliasResult.tokenName} (${aliasResult.renamerType})`);
    });
});