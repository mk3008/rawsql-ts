import { describe, it, expect } from 'vitest';
import { SelectableColumnCollector, DuplicateDetectionMode } from '../../src/transformers/SelectableColumnCollector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SelectableColumnCollector upstream option bug reproduction', () => {
    
    describe('Root Cause Analysis - JOIN table column collection bug', () => {
        it('should collect all SELECT clause columns from JOIN tables', () => {
            const bugSQL = `
                SELECT u.id, u.name, p.id, p.name 
                FROM users u 
                JOIN profiles p ON u.id = p.user_id
            `;
            
            console.log('\n=== ROOT CAUSE ANALYSIS ===');
            console.log('Query:', bugSQL.trim());
            
            const query = SelectQueryParser.parse(bugSQL);
            
            // Test with FullName mode to see all columns distinctly
            const fullNameCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.FullName
            );
            const fullNameColumns = fullNameCollector.collect(query);
            
            console.log('\nFullName mode results:');
            fullNameColumns.forEach(col => {
                const namespace = (col.value as any).getNamespace ? (col.value as any).getNamespace() : '';
                console.log(`  ${namespace}.${col.name} (from ${col.value.constructor.name})`);
            });
            console.log('Total columns:', fullNameColumns.length);
            
            // Map to namespace.column format for easier testing
            const fullNameKeys = fullNameColumns.map(col => {
                const namespace = (col.value as any).getNamespace ? (col.value as any).getNamespace() : '';
                return namespace ? `${namespace}.${col.name}` : col.name;
            });
            
            console.log('\nExpected columns: u.id, u.name, p.id, p.name, p.user_id');
            console.log('Actually collected:', fullNameKeys.join(', '));
            
            // Test: All SELECT clause columns should be present
            expect(fullNameKeys).toContain('u.id');     // u.id from SELECT
            expect(fullNameKeys).toContain('u.name');   // u.name from SELECT
            expect(fullNameKeys).toContain('p.id');     // p.id from SELECT
            expect(fullNameKeys).toContain('p.name');   // p.name from SELECT
            expect(fullNameKeys).toContain('p.user_id'); // p.user_id from JOIN condition
            
            // Should have exactly 5 columns: u.id, u.name, p.id, p.name, p.user_id
            expect(fullNameColumns.length).toBe(5);
            
            // Log success or failure
            if (fullNameKeys.includes('p.id') && fullNameKeys.includes('p.name')) {
                console.log('✅ FIX SUCCESSFUL - All JOIN table SELECT columns collected');
            } else {
                console.log('❌ ISSUE CONFIRMED - Missing JOIN table SELECT columns');
                console.log('Missing columns:', ['p.id', 'p.name'].filter(col => !fullNameKeys.includes(col)));
            }
        });
    });
    
    describe('Working Example (Simple CTE)', () => {
        it('should collect upstream columns from simple CTE correctly', () => {
            const workingSQL = `
                WITH user_stats AS (
                  SELECT u.id, u.name, u.email, COUNT(p.id) as post_count
                  FROM users u
                  LEFT JOIN posts p ON u.id = p.user_id
                  GROUP BY u.id, u.name, u.email
                )
                SELECT us.name, us.post_count
                FROM user_stats us
                WHERE us.post_count > 5
            `;

            const upstreamCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.ColumnNameOnly,
                { upstream: true }
            );
            
            const query = SelectQueryParser.parse(workingSQL);
            const columns = upstreamCollector.collect(query);
            
            console.log('Working Example Results:');
            console.log('Columns:', columns.map(c => c.name));
            console.log('Total columns:', columns.length);
            
            // Expected: ['name', 'post_count', 'id', 'email'] according to bug report
            expect(columns.length).toBeGreaterThan(2); // Should include upstream columns
            
            const columnNames = columns.map(c => c.name);
            expect(columnNames).toContain('name');
            expect(columnNames).toContain('post_count');
        });
    });

    describe('Not Working Example (Complex Multi-CTE)', () => {
        it('should collect upstream columns from complex multi-CTE query', () => {
            const complexSQL = `-- 商品ごとの売上集計をするクエリ（売上と商品を結合）
                WITH
                  products AS (
                    SELECT product_id, product_name FROM products_table
                  ),
                  sales AS (
                    SELECT sale_id, sale_date, product_id, quantity FROM sales_table
                  ),
                  filtered_sales AS (
                    SELECT * FROM sales WHERE sale_date >= '2025-01-01' AND sale_date <= '2025-01-05'
                  ),
                  joined_data AS (
                    SELECT s.sale_id, s.product_id, p.product_name, s.quantity
                    FROM filtered_sales s
                    INNER JOIN products p ON s.product_id = p.product_id
                  ),
                  aggregated AS (
                    SELECT product_id, product_name, SUM(quantity) AS total_quantity
                    FROM joined_data
                    GROUP BY product_id, product_name
                  )
                SELECT * FROM aggregated order by product_id`;

            const upstreamCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.ColumnNameOnly,
                { upstream: true }
            );
            
            const query = SelectQueryParser.parse(complexSQL);
            const columns = upstreamCollector.collect(query);
            
            console.log('\nComplex Multi-CTE Results:');
            console.log('Columns:', columns.map(c => c.name));
            console.log('Column details:', columns.map(c => ({ name: c.name, type: c.value.constructor.name })));
            console.log('Total columns:', columns.length);
            
            // Current result according to bug report: ['product_id', 'product_name', 'total_quantity']
            // Expected result: ['product_id', 'product_name', 'sale_id', 'sale_date', 'quantity', 'total_quantity']
            
            const columnNames = columns.map(c => c.name);
            
            // Check that we get more than just the final SELECT columns
            expect(columns.length).toBeGreaterThan(3);
            
            // These should be present from upstream CTEs
            expect(columnNames).toContain('sale_id');
            expect(columnNames).toContain('sale_date');
            expect(columnNames).toContain('quantity');
            
            // These should be present from the final SELECT
            expect(columnNames).toContain('product_id');
            expect(columnNames).toContain('product_name');
            expect(columnNames).toContain('total_quantity');
        });
    });

    describe('Analysis of different collection modes', () => {
        it('should compare different SelectableColumnCollector configurations', () => {
            const complexSQL = `-- 商品ごとの売上集計をするクエリ（売上と商品を結合）
                WITH
                  products AS (
                    SELECT product_id, product_name FROM products_table
                  ),
                  sales AS (
                    SELECT sale_id, sale_date, product_id, quantity FROM sales_table
                  ),
                  filtered_sales AS (
                    SELECT * FROM sales WHERE sale_date >= '2025-01-01' AND sale_date <= '2025-01-05'
                  ),
                  joined_data AS (
                    SELECT s.sale_id, s.product_id, p.product_name, s.quantity
                    FROM filtered_sales s
                    INNER JOIN products p ON s.product_id = p.product_id
                  ),
                  aggregated AS (
                    SELECT product_id, product_name, SUM(quantity) AS total_quantity
                    FROM joined_data
                    GROUP BY product_id, product_name
                  )
                SELECT * FROM aggregated order by product_id`;

            const query = SelectQueryParser.parse(complexSQL);

            // Basic (no upstream)
            const basicCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.ColumnNameOnly
            );
            const basicColumns = basicCollector.collect(query);

            // upstream: true
            const upstreamCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.ColumnNameOnly,
                { upstream: true }
            );
            const upstreamColumns = upstreamCollector.collect(query);

            // fullName
            const fullNameCollector = new SelectableColumnCollector(
                null, false, DuplicateDetectionMode.FullName
            );
            const fullNameColumns = fullNameCollector.collect(query);

            // wildcard
            const wildcardCollector = new SelectableColumnCollector(
                null, true, DuplicateDetectionMode.ColumnNameOnly
            );
            const wildcardColumns = wildcardCollector.collect(query);

            console.log('\nComparison of different collection modes:');
            console.log(`Basic (no upstream): ${basicColumns.length} columns - ${basicColumns.map(c => c.name).join(', ')}`);
            console.log(`upstream: ${upstreamColumns.length} columns - ${upstreamColumns.map(c => c.name).join(', ')}`);
            console.log(`fullName: ${fullNameColumns.length} columns - ${fullNameColumns.map(c => c.name).join(', ')}`);
            console.log(`wildcard: ${wildcardColumns.length} columns - ${wildcardColumns.map(c => c.name).join(', ')}`);

            // The upstream collector should have MORE columns than the basic collector
            expect(upstreamColumns.length).toBeGreaterThan(basicColumns.length);
        });
    });

    describe('Expected columns from CTEs analysis', () => {
        it('should identify what columns should be available from each CTE', () => {
            const complexSQL = `-- 商品ごとの売上集計をするクエリ（売上と商品を結合）
                WITH
                  products AS (
                    SELECT product_id, product_name FROM products_table
                  ),
                  sales AS (
                    SELECT sale_id, sale_date, product_id, quantity FROM sales_table
                  ),
                  filtered_sales AS (
                    SELECT * FROM sales WHERE sale_date >= '2025-01-01' AND sale_date <= '2025-01-05'
                  ),
                  joined_data AS (
                    SELECT s.sale_id, s.product_id, p.product_name, s.quantity
                    FROM filtered_sales s
                    INNER JOIN products p ON s.product_id = p.product_id
                  ),
                  aggregated AS (
                    SELECT product_id, product_name, SUM(quantity) AS total_quantity
                    FROM joined_data
                    GROUP BY product_id, product_name
                  )
                SELECT * FROM aggregated order by product_id`;

            console.log('\nExpected columns from each CTE:');
            console.log('products: product_id, product_name');
            console.log('sales: sale_id, sale_date, product_id, quantity');
            console.log('filtered_sales: sale_id, sale_date, product_id, quantity (SELECT *)');
            console.log('joined_data: sale_id, product_id, product_name, quantity');
            console.log('aggregated: product_id, product_name, total_quantity');
            console.log('');
            console.log('Unique columns that should be collected:');
            console.log('sale_id, sale_date, product_id, product_name, quantity, total_quantity');

            // This test is just for documentation purposes
            expect(true).toBe(true);
        });
    });
});