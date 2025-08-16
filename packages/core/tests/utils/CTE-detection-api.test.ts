import { describe, it, expect } from 'vitest';
import { CTERegionDetector } from '../../src/utils/CTERegionDetector';

describe('CTE Detection API Documentation', () => {
    const sql = `
        WITH 
            users AS (
                SELECT id, name, email FROM users_table WHERE active = true
            ),
            orders AS (
                SELECT order_id, user_id, amount FROM orders_table
            )
        SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id
    `;

    describe('CTERegionDetector (Recommended API)', () => {
        it('should provide comprehensive CTE analysis with analyzeCursorPosition()', () => {
            const position = sql.indexOf('SELECT id, name') + 5; // Inside users CTE
            
            const analysis = CTERegionDetector.analyzeCursorPosition(sql, position);
            
            expect(analysis.isInCTE).toBe(true);
            expect(analysis.cteRegion?.name).toBe('users');
            expect(analysis.executableSQL).toContain('SELECT id, name, email FROM users_table');
        });

        it('should provide simple CTE name retrieval with getCursorCte()', () => {
            const position = sql.indexOf('SELECT order_id') + 5; // Inside orders CTE
            
            const cteName = CTERegionDetector.getCursorCte(sql, position);
            
            expect(cteName).toBe('orders');
        });

        it('should support 2D coordinates with getCursorCteAt()', () => {
            // Find line and column for a position inside users CTE
            const position = sql.indexOf('SELECT id, name') + 5;
            const lineCol = CTERegionDetector.positionToLineColumn(sql, position);
            
            const cteName = CTERegionDetector.getCursorCteAt(sql, lineCol!.line, lineCol!.column);
            
            expect(cteName).toBe('users');
        });

        it('should extract all CTE regions with extractCTERegions()', () => {
            const regions = CTERegionDetector.extractCTERegions(sql);
            
            expect(regions).toHaveLength(2);
            expect(regions[0].name).toBe('users');
            expect(regions[1].name).toBe('orders');
            expect(regions[0].sqlContent).toContain('SELECT id, name, email FROM users_table');
            expect(regions[1].sqlContent).toContain('SELECT order_id, user_id, amount FROM orders_table');
        });

        it('should provide editor integration with getCTEPositions()', () => {
            const positions = CTERegionDetector.getCTEPositions(sql);
            
            expect(positions).toHaveLength(3); // 2 CTEs + 1 main query
            expect(positions[0].name).toBe('users');
            expect(positions[0].type).toBe('CTE');
            expect(positions[1].name).toBe('orders');
            expect(positions[1].type).toBe('CTE');
            expect(positions[2].name).toBe('MAIN_QUERY');
            expect(positions[2].type).toBe('MAIN_QUERY');
        });

        it('should handle position conversion utilities', () => {
            const position = 100;
            
            const lineCol = CTERegionDetector.positionToLineColumn(sql, position);
            expect(lineCol).toBeDefined();
            expect(lineCol!.line).toBeGreaterThan(0);
            expect(lineCol!.column).toBeGreaterThan(0);
        });
    });

    describe('Usage Examples', () => {
        it('should demonstrate typical editor integration scenario', () => {
            // Example: User clicks at a position in the editor
            const cursorPosition = sql.indexOf('amount FROM orders_table') + 2;
            
            // Get comprehensive analysis for context
            const analysis = CTERegionDetector.analyzeCursorPosition(sql, cursorPosition);
            
            if (analysis.isInCTE) {
                console.log(`🎯 User is editing CTE: ${analysis.cteRegion!.name}`);
                console.log(`📝 Executable SQL for testing: ${analysis.executableSQL}`);
                
                // Editor could show a "Run CTE" button with this SQL
                expect(analysis.executableSQL).toContain('SELECT order_id, user_id, amount FROM orders_table');
            }
            
            // Get just the CTE name for simple operations
            const cteName = CTERegionDetector.getCursorCte(sql, cursorPosition);
            expect(cteName).toBe('orders');
        });

        it('should demonstrate 2D coordinates for IDE integration', () => {
            // Example: IDE provides line/column instead of character position
            const line = 5; // Approximate line in orders CTE
            const column = 20; // Approximate column
            
            const cteName = CTERegionDetector.getCursorCteAt(sql, line, column);
            
            // Result depends on exact SQL formatting, but should be consistent
            console.log(`🎯 CTE at Line ${line}, Column ${column}: ${cteName || 'none'}`);
        });

        it('should demonstrate navigation and outline features', () => {
            // Example: Building an outline/navigation panel
            const sections = CTERegionDetector.getCTEPositions(sql);
            
            const outline = sections.map(section => ({
                label: section.type === 'CTE' ? `📊 CTE: ${section.name}` : `🎯 ${section.name}`,
                position: section.startPosition,
                type: section.type
            }));
            
            expect(outline).toHaveLength(3);
            expect(outline[0].label).toBe('📊 CTE: users');
            expect(outline[1].label).toBe('📊 CTE: orders');
            expect(outline[2].label).toBe('🎯 MAIN_QUERY');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid positions gracefully', () => {
            const cteName = CTERegionDetector.getCursorCte(sql, -1);
            expect(cteName).toBeNull();
            
            const analysis = CTERegionDetector.analyzeCursorPosition(sql, 999999);
            expect(analysis.isInCTE).toBe(false);
        });

        it('should handle invalid line/column coordinates', () => {
            const cteName = CTERegionDetector.getCursorCteAt(sql, 0, 0);
            expect(cteName).toBeNull();
            
            const cteName2 = CTERegionDetector.getCursorCteAt(sql, 999, 999);
            expect(cteName2).toBeNull();
        });

        it('should handle SQL without CTEs', () => {
            const simpleSql = 'SELECT * FROM users WHERE active = true';
            
            const regions = CTERegionDetector.extractCTERegions(simpleSql);
            expect(regions).toHaveLength(0);
            
            const analysis = CTERegionDetector.analyzeCursorPosition(simpleSql, 10);
            expect(analysis.isInCTE).toBe(false);
            expect(analysis.cteRegion).toBeNull();
        });
    });
});