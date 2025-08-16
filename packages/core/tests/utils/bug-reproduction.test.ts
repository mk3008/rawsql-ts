import { describe, it, expect } from 'vitest';
import { CTERegionDetector } from '../../src/utils/CTERegionDetector';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTE Name Detection API', () => {
    const sql = `-- 商品ごとの売上集計をするクエリ（売上と商品を結合）
WITH
  products AS (
    SELECT product_id, product_name FROM products_table
  ),
  sales AS (
    SELECT sale_id, sale_date, product_id, quantity FROM sales_table
  ),
  filtered_sales AS (
    -- ここで売上をフィルタ（欠陥: 期間条件が厳しすぎてデータが減りすぎ）
    SELECT * FROM sales WHERE sale_date >= '2025-01-01' AND sale_date <= '2025-01-05'
  ),
  joined_data AS (
    -- 売上と商品を結合
    SELECT s.sale_id, s.product_id, p.product_name, s.quantity
    FROM filtered_sales s
    INNER JOIN products p ON s.product_id = p.product_id
  ),
  aggregated AS (
    -- 商品ごとの合計数量を算出
    SELECT product_id, product_name, SUM(quantity) AS total_quantity
    FROM joined_data
    GROUP BY product_id, product_name
  )
SELECT * FROM aggregated order by product_id`;

    it('should detect CTE name at cursor position 133 (SELECT in sales CTE)', () => {
        // Position 133 is at "T" in "SELECT" of sales CTE (Line 7, Column 10)
        const cursorPosition = 133;
        
        // Verify the character at position 133
        expect(sql.charAt(cursorPosition)).toBe('T'); // "T" from "SELECT"
        
        // Test with both APIs for consistency
        const cteNameFromParser = SelectQueryParser.getCursorCte(sql, cursorPosition);
        const cteNameFromDetector = CTERegionDetector.getCursorCte(sql, cursorPosition);
        
        console.log(`Position ${cursorPosition} character: "${sql.charAt(cursorPosition)}"`);
        console.log(`CTE name (SelectQueryParser): ${cteNameFromParser || 'null'}`);
        console.log(`CTE name (CTERegionDetector): ${cteNameFromDetector || 'null'}`);
        
        // Both APIs should return the same result
        expect(cteNameFromParser).toBe('sales');
        expect(cteNameFromDetector).toBe('sales');
        expect(cteNameFromParser).toBe(cteNameFromDetector);
    });

    it('should detect correct CTE names at various cursor positions', () => {
        const testCases = [
            { position: 60, expectedCTE: 'products', description: 'Line 3, Col 3 - "p"' },
            { position: 95, expectedCTE: 'products', description: 'Line 5, Col 3 - ")"' },
            { position: 105, expectedCTE: 'products', description: 'Line 6, Col 3 - "s" (actually in products CTE)' },
            { position: 133, expectedCTE: 'sales', description: 'Line 7, Col 10 - "T"' },
            { position: 180, expectedCTE: 'sales', description: 'Line 8, Col 3 - ")"' },
        ];

        testCases.forEach(testCase => {
            const cteNameFromParser = SelectQueryParser.getCursorCte(sql, testCase.position);
            const cteNameFromDetector = CTERegionDetector.getCursorCte(sql, testCase.position);
            
            console.log(`\nPosition ${testCase.position} (${testCase.description}):`);
            console.log(`  Character: "${sql.charAt(testCase.position)}"`);
            console.log(`  CTE name (Parser): ${cteNameFromParser || 'null'}`);
            console.log(`  CTE name (Detector): ${cteNameFromDetector || 'null'}`);
            console.log(`  Expected: ${testCase.expectedCTE}`);
            
            // Both APIs should return the same result
            expect(cteNameFromParser).toBe(testCase.expectedCTE);
            expect(cteNameFromDetector).toBe(testCase.expectedCTE);
            expect(cteNameFromParser).toBe(cteNameFromDetector);
        });
    });

    it('should analyze the SQL structure and CTE boundaries', () => {
        // Extract all CTE regions to understand the structure
        const regions = CTERegionDetector.extractCTERegions(sql);
        
        console.log('\nCTE Regions:');
        regions.forEach((region, index) => {
            console.log(`${index + 1}. ${region.name}: positions ${region.startPosition}-${region.endPosition}`);
            console.log(`   Content: ${region.sqlContent.substring(0, 50)}...`);
            
            // Show the actual text at boundaries
            const beforeStart = sql.substring(Math.max(0, region.startPosition - 10), region.startPosition);
            const afterEnd = sql.substring(region.endPosition, Math.min(sql.length, region.endPosition + 10));
            console.log(`   Before start: "${beforeStart}"`);
            console.log(`   After end: "${afterEnd}"`);
        });
        
        // Verify we have all expected CTEs
        const expectedCTEs = ['products', 'sales', 'filtered_sales', 'joined_data', 'aggregated'];
        expect(regions.length).toBe(expectedCTEs.length);
        
        regions.forEach((region, index) => {
            expect(region.name).toBe(expectedCTEs[index]);
        });
        
        // Analyze the gap between products and sales CTEs
        console.log('\nAnalyzing gap between products and sales:');
        const productsEnd = regions[0].endPosition; // 109
        const salesStart = regions[1].startPosition; // 113
        const gapText = sql.substring(productsEnd, salesStart);
        console.log(`Gap (${productsEnd}-${salesStart}): "${gapText}"`);
        console.log(`Position 105 is in this gap: ${105 >= productsEnd && 105 < salesStart}`);
        
        // Test the extended boundaries logic
        console.log('\nTesting extended boundaries:');
        const result105 = CTERegionDetector.analyzeCursorPosition(sql, 105);
        console.log(`Position 105 result: ${result105.cteRegion?.name || 'no CTE'}`);
        
        // Also check the text around position 105
        const contextStart = Math.max(0, 105 - 10);
        const contextEnd = Math.min(sql.length, 105 + 10);
        const context = sql.substring(contextStart, contextEnd);
        console.log(`Position 105 context: "${context}"`);
        console.log(`Position 105 char: "${sql.charAt(105)}" (code: ${sql.charCodeAt(105)})`);
        
        // Let's manually examine the SQL structure around the boundary
        console.log('\nManual boundary analysis:');
        console.log(`Position 109 (products end): "${sql.charAt(109)}" - should be ")" or end of products`);
        console.log(`Position 110: "${sql.charAt(110)}"`);
        console.log(`Position 111: "${sql.charAt(111)}"`);
        console.log(`Position 112: "${sql.charAt(112)}"`);
        console.log(`Position 113 (sales start): "${sql.charAt(113)}" - should be start of "sales"`);
        
        // Find actual positions of key tokens
        const productsAsIndex = sql.indexOf('products AS');
        const salesAsIndex = sql.indexOf('sales AS');
        console.log(`\n"products AS" at position: ${productsAsIndex}`);
        console.log(`"sales AS" at position: ${salesAsIndex}`);
        console.log(`Position 105 is ${105 < salesAsIndex ? 'before' : 'after'} "sales AS"`);
    });

    it('should show line and column information for debugging', () => {
        // Helper function to convert position to line/column
        const getLineColumn = (text: string, position: number) => {
            const lines = text.substring(0, position).split('\n');
            return {
                line: lines.length,
                column: lines[lines.length - 1].length + 1
            };
        };

        const testPositions = [133, 105, 180];
        
        testPositions.forEach(pos => {
            const lineCol = getLineColumn(sql, pos);
            const result = CTERegionDetector.analyzeCursorPosition(sql, pos);
            
            console.log(`\nPosition ${pos} (Line ${lineCol.line}, Column ${lineCol.column}):`);
            console.log(`  Character: "${sql.charAt(pos)}" (code: ${sql.charCodeAt(pos)})`);
            console.log(`  CTE: ${result.cteRegion?.name || 'none'}`);
            
            // Show surrounding context
            const start = Math.max(0, pos - 10);
            const end = Math.min(sql.length, pos + 10);
            const context = sql.substring(start, end);
            const markerPos = pos - start;
            const marker = ' '.repeat(markerPos) + '^';
            console.log(`  Context: "${context}"`);
            console.log(`           ${marker}`);
        });
    });

    it('should support 2D coordinates (line/column) for CTE detection', () => {
        // Test the new getCursorCteAt method with line/column coordinates
        const testCases = [
            { line: 7, column: 10, expectedCTE: 'sales', description: 'Line 7, Column 10 - "T" in SELECT' },
            { line: 3, column: 5, expectedCTE: 'products', description: 'Line 3, Column 5 - inside products CTE' },
            { line: 6, column: 3, expectedCTE: 'sales', description: 'Line 6, Column 3 - start of sales CTE' },
        ];

        testCases.forEach(testCase => {
            const cteNameFromParser = SelectQueryParser.getCursorCteAt(sql, testCase.line, testCase.column);
            const cteNameFromDetector = CTERegionDetector.getCursorCteAt(sql, testCase.line, testCase.column);
            
            console.log(`\n${testCase.description}:`);
            console.log(`  Line ${testCase.line}, Column ${testCase.column}`);
            console.log(`  CTE name (Parser): ${cteNameFromParser || 'null'}`);
            console.log(`  CTE name (Detector): ${cteNameFromDetector || 'null'}`);
            console.log(`  Expected: ${testCase.expectedCTE || 'null'}`);
            
            // Both APIs should return the same result
            expect(cteNameFromParser).toBe(testCase.expectedCTE);
            expect(cteNameFromDetector).toBe(testCase.expectedCTE);
            expect(cteNameFromParser).toBe(cteNameFromDetector);
        });

        // Test position conversion methods (both APIs should work the same)
        const lineColFromParser = SelectQueryParser.positionToLineColumn(sql, 133);
        const lineColFromDetector = CTERegionDetector.positionToLineColumn(sql, 133);
        
        console.log(`\nPosition 133 converts to:`);
        console.log(`  Parser: Line ${lineColFromParser?.line}, Column ${lineColFromParser?.column}`);
        console.log(`  Detector: Line ${lineColFromDetector?.line}, Column ${lineColFromDetector?.column}`);
        
        expect(lineColFromParser).toBeDefined();
        expect(lineColFromDetector).toBeDefined();
        expect(lineColFromParser!.line).toBe(7);
        expect(lineColFromParser!.column).toBe(10);
        expect(lineColFromParser).toEqual(lineColFromDetector);
    });
});