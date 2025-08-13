import { describe, it, expect } from 'vitest';
import { LexemeCursor } from '../../src/utils/LexemeCursor';
import { TokenType } from '../../src/models/Lexeme';

describe('LexemeCursor - Practical CTE Name Position Detection Tests', () => {
    describe('CTE name retrieval in complex SQL statements', () => {
        it('should retrieve CTE name from cursor position in simple CTE', () => {
            // Arrange
            const sql = `
                -- Main query
                WITH user_summary AS (
                    SELECT id, name, email 
                    FROM users 
                    WHERE active = true
                )
                SELECT * FROM user_summary
            `;
            
            // Test at each character position of CTE name "user_summary"
            const cteNameStartPos = sql.indexOf('user_summary');
            const testPositions = [
                cteNameStartPos,      // 'u'
                cteNameStartPos + 4,  // '_'
                cteNameStartPos + 11, // 'y'
            ];
            
            // Act & Assert
            testPositions.forEach(pos => {
                const lexeme = LexemeCursor.findLexemeAtPosition(sql, pos);
                expect(lexeme).toBeDefined();
                expect(lexeme!.value).toBe('user_summary');
                expect(lexeme!.type).toBe(TokenType.Identifier);
                expect(lexeme!.position!.startPosition).toBe(cteNameStartPos);
                expect(lexeme!.position!.endPosition).toBe(cteNameStartPos + 12);
            });
        });

        it('should accurately retrieve CTE names with multiple CTEs, comments, and mixed whitespace', () => {
            // Arrange
            const sql = `
                /* Common queries for data extraction */
                WITH 
                    -- Extract active users
                    active_users AS (
                        SELECT 
                            id, 
                            name, 
                            email,
                            created_at
                        FROM users 
                        WHERE active = true
                            AND deleted_at IS NULL
                    ),
                    
                    /* Recent order information */
                    recent_orders AS (
                        SELECT 
                            user_id,
                            COUNT(*) as order_count,
                            MAX(created_at) as last_order_date
                        FROM orders 
                        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                        GROUP BY user_id
                    ),
                    
                    -- Join users with orders
                    user_with_orders AS (
                        SELECT 
                            u.id,
                            u.name,
                            u.email,
                            COALESCE(r.order_count, 0) as order_count
                        FROM active_users u
                        LEFT JOIN recent_orders r ON u.id = r.user_id
                    )
                
                SELECT * FROM user_with_orders
                ORDER BY order_count DESC
            `;
            
            // Test at each CTE name position
            const cteTests = [
                { name: 'active_users', expectedType: TokenType.Identifier },
                { name: 'recent_orders', expectedType: TokenType.Identifier },  
                { name: 'user_with_orders', expectedType: TokenType.Identifier }
            ];
            
            cteTests.forEach(test => {
                const ctePos = sql.indexOf(test.name);
                const middlePos = ctePos + Math.floor(test.name.length / 2);
                
                // Act
                const lexeme = LexemeCursor.findLexemeAtPosition(sql, middlePos);
                
                // Assert
                expect(lexeme).toBeDefined();
                expect(lexeme!.value).toBe(test.name);
                expect(lexeme!.type).toBe(test.expectedType);
                expect(lexeme!.position!.startPosition).toBe(ctePos);
                expect(lexeme!.position!.endPosition).toBe(ctePos + test.name.length);
            });
        });

        it('should return null when cursor is inside inline comments containing CTE-like names', () => {
            // Arrange  
            const sql = `
                WITH /* cte_in_comment */ actual_cte AS (
                    SELECT id FROM users -- user_table_comment
                )
                SELECT * FROM actual_cte
            `;
            
            // Position inside comment
            const commentPos = sql.indexOf('cte_in_comment') + 5;
            
            // Act
            const lexeme = LexemeCursor.findLexemeAtPosition(sql, commentPos);
            
            // Assert - should return null since cursor is inside comment
            expect(lexeme).toBeNull();
            
            // Also verify that actual CTE name can be retrieved correctly
            const actualCtePos = sql.indexOf('actual_cte');
            const actualLexeme = LexemeCursor.findLexemeAtPosition(sql, actualCtePos + 3);
            expect(actualLexeme).toBeDefined();
            expect(actualLexeme!.value).toBe('actual_cte');
        });

        it('should accurately retrieve CTE names in reference sections', () => {
            // Arrange
            const sql = `
                -- Sales data analysis
                WITH 
                    monthly_sales AS (
                        SELECT 
                            DATE_TRUNC('month', created_at) as month,
                            SUM(amount) as total_amount
                        FROM sales
                        GROUP BY DATE_TRUNC('month', created_at)
                    ),
                    top_months AS (
                        SELECT * FROM monthly_sales -- Reference to CTE
                        WHERE total_amount > 10000
                        ORDER BY total_amount DESC
                        LIMIT 5
                    )
                SELECT 
                    tm.month,
                    tm.total_amount,
                    ms.total_amount as original_amount
                FROM top_months tm  -- CTE reference 1
                JOIN monthly_sales ms ON tm.month = ms.month  -- CTE reference 2
            `;
            
            // Test CTE references in main query
            const references = [
                { name: 'top_months', context: 'FROM clause' },
                { name: 'monthly_sales', context: 'JOIN clause' }
            ];
            
            references.forEach(ref => {
                // Find CTE references in FROM and JOIN clauses
                const fromIndex = sql.lastIndexOf(`FROM ${ref.name}`);
                const joinIndex = sql.lastIndexOf(`JOIN ${ref.name}`);
                const refPos = fromIndex > -1 ? fromIndex + 5 : joinIndex + 5;
                
                if (refPos > 4) { // Test only if found
                    const lexeme = LexemeCursor.findLexemeAtPosition(sql, refPos + 2);
                    expect(lexeme).toBeDefined();
                    expect(lexeme!.value).toBe(ref.name);
                    expect(lexeme!.type).toBe(TokenType.Identifier);
                }
            });
        });

        it('should detect positions in nested CTEs with complex comment structures', () => {
            // Arrange
            const sql = `
                /*
                 * Multi-level analysis query
                 * Author: Development Team
                 * Date: 2024-01-01
                 */
                WITH RECURSIVE 
                    -- Level 1: Base data
                    base_data AS (
                        SELECT 
                            id,
                            parent_id,
                            name,
                            level
                        FROM categories 
                        WHERE parent_id IS NULL
                        
                        UNION ALL
                        
                        -- Recursive part
                        SELECT 
                            c.id,
                            c.parent_id, 
                            c.name,
                            b.level + 1
                        FROM categories c
                        INNER JOIN base_data b ON c.parent_id = b.id
                    ),
                    
                    /* Level 2: Aggregated data */
                    aggregated_data AS (
                        SELECT 
                            bd.name,
                            bd.level,
                            COUNT(*) OVER (PARTITION BY bd.level) as count_per_level
                        FROM base_data bd  -- CTE reference
                        WHERE bd.level <= 3
                    )
                    
                -- Main query
                SELECT 
                    ad.name,
                    ad.level,
                    ad.count_per_level
                FROM aggregated_data ad  -- Final CTE reference
                ORDER BY ad.level, ad.name
            `;
            
            // Test each CTE name
            const cteNames = ['base_data', 'aggregated_data'];
            
            cteNames.forEach(cteName => {
                // CTE definition part
                const definePos = sql.indexOf(cteName);
                const defineLexeme = LexemeCursor.findLexemeAtPosition(sql, definePos + 2);
                
                expect(defineLexeme).toBeDefined();
                expect(defineLexeme!.value).toBe(cteName);
                expect(defineLexeme!.type).toBe(TokenType.Identifier);
                
                // CTE reference part (test last reference if multiple exist)
                const lastRefPos = sql.lastIndexOf(cteName);
                if (lastRefPos !== definePos) {
                    const refLexeme = LexemeCursor.findLexemeAtPosition(sql, lastRefPos + 1);
                    expect(refLexeme).toBeDefined();
                    expect(refLexeme!.value).toBe(cteName);
                }
            });
        });
        
        it('should detect positions with mixed comments and CTE names', () => {
            // Arrange
            const sql = `
                -- Sales analysis query
                WITH 
                    /* Monthly revenue data */
                    monthly_revenue AS (
                        SELECT 
                            extract(year from order_date) as year,
                            extract(month from order_date) as month,
                            SUM(amount) as revenue  -- Revenue total
                        FROM orders
                        WHERE order_date >= '2024-01-01'  -- Target period
                        GROUP BY 1, 2
                    ),
                    -- Annual summary
                    yearly_summary AS (
                        SELECT 
                            year,
                            SUM(revenue) as total_revenue,  -- Annual revenue
                            AVG(revenue) as avg_monthly_revenue  -- Monthly average
                        FROM monthly_revenue  -- Reference to previous CTE
                        GROUP BY year
                    )
                SELECT * FROM yearly_summary  -- Final result
                ORDER BY year DESC
            `;
            
            // Position inside comment (should return null)
            const commentPos = sql.indexOf('Sales analysis') + 1;
            const commentLexeme = LexemeCursor.findLexemeAtPosition(sql, commentPos);
            expect(commentLexeme).toBeNull();
            
            // Verify that CTE names can be retrieved correctly
            const ctePos = sql.indexOf('monthly_revenue');
            const cteLexeme = LexemeCursor.findLexemeAtPosition(sql, ctePos + 5);
            expect(cteLexeme).toBeDefined();
            expect(cteLexeme!.value).toBe('monthly_revenue');
            expect(cteLexeme!.type).toBe(TokenType.Identifier);
        });
    });
    
    describe('CTE structure analysis with getAllLexemesWithPosition', () => {
        it('should accurately analyze entire CTE structure', () => {
            // Arrange
            const sql = `
                WITH 
                    users_cte AS (SELECT * FROM users),
                    orders_cte AS (SELECT * FROM orders)  
                SELECT * FROM users_cte u JOIN orders_cte o ON u.id = o.user_id
            `;
            
            // Act
            const lexemes = LexemeCursor.getAllLexemesWithPosition(sql);
            
            // Assert
            const cteIdentifiers = lexemes.filter(l => 
                l.value === 'users_cte' || l.value === 'orders_cte'
            );
            
            // Verify that each CTE name appears multiple times (definition and reference)
            expect(cteIdentifiers.filter(l => l.value === 'users_cte')).toHaveLength(2);
            expect(cteIdentifiers.filter(l => l.value === 'orders_cte')).toHaveLength(2);
            
            // Verify that position information is accurately set
            cteIdentifiers.forEach(lexeme => {
                expect(lexeme.position).toBeDefined();
                expect(lexeme.position!.startPosition).toBeGreaterThanOrEqual(0);
                expect(lexeme.position!.endPosition).toBeGreaterThan(lexeme.position!.startPosition);
                expect(lexeme.type).toBe(TokenType.Identifier);
            });
        });
    });
});