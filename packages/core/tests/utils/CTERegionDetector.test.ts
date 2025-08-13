import { describe, it, expect } from 'vitest';
import { CTERegionDetector } from '../../src/utils/CTERegionDetector';

describe('CTERegionDetector - SQL Editor Features', () => {
    describe('analyzeCursorPosition', () => {
        it('should detect cursor inside CTE and return executable CTE SQL', () => {
            // Arrange
            const sql = `
                WITH monthly_sales AS (
                    SELECT 
                        DATE_TRUNC('month', created_at) as month,
                        SUM(amount) as total_amount
                    FROM sales
                    GROUP BY 1
                ),
                top_months AS (
                    SELECT * FROM monthly_sales
                    WHERE total_amount > 10000
                    ORDER BY total_amount DESC
                )
                SELECT * FROM top_months
            `;
            
            // Position inside monthly_sales CTE (around "SELECT")
            const cursorInFirstCTE = sql.indexOf('SELECT', sql.indexOf('monthly_sales'));
            
            // Act
            const result = CTERegionDetector.analyzeCursorPosition(sql, cursorInFirstCTE);
            
            // Assert
            expect(result.isInCTE).toBe(true);
            expect(result.cteRegion).toBeDefined();
            expect(result.cteRegion!.name).toBe('monthly_sales');
            expect(result.executableSQL).toContain('SELECT');
            expect(result.executableSQL).toContain('DATE_TRUNC');
            expect(result.executableSQL).toContain('FROM sales');
        });
        
        it('should detect cursor in main query and return main SQL', () => {
            // Arrange
            const sql = `
                WITH user_summary AS (
                    SELECT id, name FROM users WHERE active = true
                )
                SELECT * FROM user_summary ORDER BY name
            `;
            
            // Position in main query (around final "SELECT")
            const cursorInMainQuery = sql.lastIndexOf('SELECT');
            
            // Act
            const result = CTERegionDetector.analyzeCursorPosition(sql, cursorInMainQuery);
            
            // Assert
            expect(result.isInCTE).toBe(false);
            expect(result.cteRegion).toBeNull();
            expect(result.executableSQL).toContain('SELECT * FROM user_summary');
            expect(result.executableSQL).toContain('ORDER BY name');
        });
        
        it('should handle multiple CTEs correctly', () => {
            // Arrange
            const sql = `
                WITH 
                    active_users AS (
                        SELECT id, name FROM users WHERE active = true
                    ),
                    recent_orders AS (
                        SELECT user_id, COUNT(*) as order_count
                        FROM orders 
                        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY user_id
                    ),
                    user_stats AS (
                        SELECT u.id, u.name, COALESCE(r.order_count, 0) as orders
                        FROM active_users u
                        LEFT JOIN recent_orders r ON u.id = r.user_id
                    )
                SELECT * FROM user_stats WHERE orders > 5
            `;
            
            // Test position in second CTE (recent_orders)
            const cursorInSecondCTE = sql.indexOf('COUNT(*)');
            const result = CTERegionDetector.analyzeCursorPosition(sql, cursorInSecondCTE);
            
            // Assert
            expect(result.isInCTE).toBe(true);
            expect(result.cteRegion!.name).toBe('recent_orders');
            expect(result.executableSQL).toContain('SELECT user_id, COUNT(*) as order_count');
            expect(result.executableSQL).toContain('FROM orders');
        });
        
        it('should handle RECURSIVE CTEs', () => {
            // Arrange
            const sql = `
                WITH RECURSIVE category_tree AS (
                    SELECT id, name, parent_id, 1 as level
                    FROM categories
                    WHERE parent_id IS NULL
                    
                    UNION ALL
                    
                    SELECT c.id, c.name, c.parent_id, ct.level + 1
                    FROM categories c
                    JOIN category_tree ct ON c.parent_id = ct.id
                )
                SELECT * FROM category_tree ORDER BY level, name
            `;
            
            // Position inside the recursive CTE
            const cursorInRecursiveCTE = sql.indexOf('UNION ALL');
            const result = CTERegionDetector.analyzeCursorPosition(sql, cursorInRecursiveCTE);
            
            // Assert
            expect(result.isInCTE).toBe(true);
            expect(result.cteRegion!.name).toBe('category_tree');
            expect(result.executableSQL).toContain('UNION ALL');
        });
    });
    
    describe('extractCTERegions', () => {
        it('should extract all CTE regions with correct boundaries', () => {
            // Arrange
            const sql = `
                WITH 
                    first_cte AS (
                        SELECT id FROM table1
                    ),
                    second_cte AS (
                        SELECT name FROM table2 WHERE id > 10
                    )
                SELECT * FROM first_cte JOIN second_cte USING (id)
            `;
            
            // Act
            const regions = CTERegionDetector.extractCTERegions(sql);
            
            // Assert
            expect(regions).toHaveLength(2);
            
            expect(regions[0].name).toBe('first_cte');
            expect(regions[0].sqlContent).toContain('SELECT id FROM table1');
            
            expect(regions[1].name).toBe('second_cte');
            expect(regions[1].sqlContent).toContain('SELECT name FROM table2');
            expect(regions[1].sqlContent).toContain('WHERE id > 10');
        });
        
        it('should return empty array for SQL without CTEs', () => {
            // Arrange
            const sql = 'SELECT * FROM users WHERE active = true';
            
            // Act
            const regions = CTERegionDetector.extractCTERegions(sql);
            
            // Assert
            expect(regions).toHaveLength(0);
        });
    });
    
    describe('getCTEPositions - Editor Integration', () => {
        it('should return positions for all executable sections', () => {
            // Arrange
            const sql = `
                WITH monthly_sales AS (
                    SELECT DATE_TRUNC('month', created_at) as month,
                           SUM(amount) as total_amount
                    FROM sales
                    GROUP BY 1
                ),
                top_months AS (
                    SELECT * FROM monthly_sales
                    WHERE total_amount > 10000
                )
                SELECT * FROM top_months ORDER BY total_amount DESC
            `;
            
            // Act
            const positions = CTERegionDetector.getCTEPositions(sql);
            
            // Assert
            expect(positions).toHaveLength(3); // 2 CTEs + 1 main query
            
            expect(positions[0].name).toBe('monthly_sales');
            expect(positions[0].type).toBe('CTE');
            expect(positions[0].startPosition).toBeGreaterThan(0);
            
            expect(positions[1].name).toBe('top_months');
            expect(positions[1].type).toBe('CTE');
            expect(positions[1].startPosition).toBeGreaterThan(positions[0].startPosition);
            
            expect(positions[2].name).toBe('MAIN_QUERY');
            expect(positions[2].type).toBe('MAIN_QUERY');
            expect(positions[2].startPosition).toBeGreaterThan(positions[1].startPosition);
        });
        
        it('should handle SQL without CTEs', () => {
            // Arrange
            const sql = 'SELECT * FROM users WHERE active = true ORDER BY name';
            
            // Act
            const positions = CTERegionDetector.getCTEPositions(sql);
            
            // Assert
            expect(positions).toHaveLength(1);
            expect(positions[0].name).toBe('MAIN_QUERY');
            expect(positions[0].type).toBe('MAIN_QUERY');
            expect(positions[0].startPosition).toBe(0);
        });
    });
    
    describe('Real Editor Use Cases', () => {
        it('should support typical editor workflow - cursor at different positions', () => {
            // Arrange - Complex SQL with multiple CTEs
            const sql = `
                -- Sales analysis query
                WITH 
                    monthly_data AS (
                        SELECT 
                            DATE_TRUNC('month', order_date) as month,
                            SUM(amount) as revenue,
                            COUNT(*) as order_count
                        FROM orders
                        WHERE order_date >= '2024-01-01'
                        GROUP BY 1
                    ),
                    quarterly_summary AS (
                        SELECT 
                            DATE_TRUNC('quarter', month) as quarter,
                            SUM(revenue) as total_revenue,
                            AVG(order_count) as avg_monthly_orders
                        FROM monthly_data
                        GROUP BY 1
                    )
                SELECT 
                    quarter,
                    total_revenue,
                    avg_monthly_orders,
                    LAG(total_revenue) OVER (ORDER BY quarter) as prev_quarter_revenue
                FROM quarterly_summary
                ORDER BY quarter
            `;
            
            // Test various cursor positions
            const testCases = [
                {
                    description: 'Cursor in first CTE',
                    position: sql.indexOf('SUM(amount)'),
                    expectedCTE: 'monthly_data',
                    shouldBeInCTE: true
                },
                {
                    description: 'Cursor in second CTE', 
                    position: sql.indexOf('AVG(order_count)'),
                    expectedCTE: 'quarterly_summary',
                    shouldBeInCTE: true
                },
                {
                    description: 'Cursor in main query',
                    position: sql.indexOf('LAG(total_revenue)'),
                    expectedCTE: null,
                    shouldBeInCTE: false
                }
            ];
            
            testCases.forEach(testCase => {
                // Act
                const result = CTERegionDetector.analyzeCursorPosition(sql, testCase.position);
                
                // Assert
                expect(result.isInCTE, `${testCase.description}: isInCTE`).toBe(testCase.shouldBeInCTE);
                
                if (testCase.shouldBeInCTE) {
                    expect(result.cteRegion!.name, `${testCase.description}: CTE name`).toBe(testCase.expectedCTE);
                    expect(result.executableSQL, `${testCase.description}: has executable SQL`).toBeDefined();
                } else {
                    expect(result.cteRegion, `${testCase.description}: no CTE region`).toBeNull();
                    expect(result.executableSQL, `${testCase.description}: main query SQL`).toContain('SELECT');
                    expect(result.executableSQL, `${testCase.description}: main query SQL`).toContain('FROM quarterly_summary');
                }
            });
        });
        
        it('should extract clean executable SQL for editor execution', () => {
            // Arrange
            const sql = `
                WITH user_stats AS (
                    SELECT 
                        id,
                        name,
                        email,
                        COUNT(*) OVER() as total_users
                    FROM users
                    WHERE active = true
                      AND created_at >= '2024-01-01'
                    ORDER BY created_at DESC
                )
                SELECT * FROM user_stats WHERE total_users > 100
            `;
            
            // Position inside the CTE
            const cursorPosition = sql.indexOf('COUNT(*) OVER()');
            
            // Act
            const result = CTERegionDetector.analyzeCursorPosition(sql, cursorPosition);
            
            // Assert
            expect(result.isInCTE).toBe(true);
            expect(result.executableSQL).toBeDefined();
            
            // Verify the extracted SQL is clean and executable
            const extractedSQL = result.executableSQL!.trim();
            expect(extractedSQL.startsWith('SELECT')).toBe(true);
            expect(extractedSQL).toContain('FROM users');
            expect(extractedSQL).toContain('WHERE active = true');
            expect(extractedSQL).toContain('ORDER BY created_at DESC');
            
            // Should not contain CTE wrapper syntax
            expect(extractedSQL).not.toContain('WITH');
            expect(extractedSQL).not.toContain('user_stats AS');
        });
    });
});